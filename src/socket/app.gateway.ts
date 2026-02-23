import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  UnauthorizedException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ACCESS_TOKEN_COOKIE } from '../common/config/cookie.config';
import * as cookie from 'cookie';

interface JwtPayload {
  sub: string;
  email: string;
}

export interface SocketWithAuth extends Socket {
  data: {
    user: JwtPayload;
  };
}

import { ChatService } from '../chat/chat.service';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: 'events',
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AppGateway.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChatService))
    private chatService: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new UnauthorizedException('No token found');
      }

      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });

      // Attach user to socket
      (client as SocketWithAuth).data.user = payload;

      // Join user to their personal room
      await client.join(`user:${payload.sub}`);

      // Join rooms of everyone the user follows to receive their status updates
      const following = await this.prisma.follow.findMany({
        where: { followerId: payload.sub },
        select: { followingId: true },
      });
      const followRooms = following.map((f) => `presence:${f.followingId}`);
      if (followRooms.length > 0) {
        await client.join(followRooms);
      }

      // Join our own presence room so others can track us
      await client.join(`presence:${payload.sub}`);

      // Update online status
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { isOnline: true },
      });

      // Notify anyone tracking this user (in a single emit to the presence room)
      this.server.to(`presence:${payload.sub}`).emit('user_status', {
        userId: payload.sub,
        isOnline: true,
      });

      this.logger.log(`User connected: ${payload.sub}`);
    } catch (e: unknown) {
      this.logger.error(
        `Socket connection failed: ${e instanceof Error ? e.message : 'Unknown'}`,
      );
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const user = (client as SocketWithAuth).data?.user;
    if (user) {
      await this.prisma.user.update({
        where: { id: user.sub },
        data: { isOnline: false, lastSeenAt: new Date() },
      });

      // Notify anyone tracking this user
      this.server.to(`presence:${user.sub}`).emit('user_status', {
        userId: user.sub,
        isOnline: false,
        lastSeenAt: new Date().toISOString(),
      });

      this.logger.log(`User disconnected: ${user.sub}`);
    }
  }

  // --- Real-time Notifications ---
  sendNotification(
    userId: string,
    notification: {
      id: string;
      type: string;
      content: string;
      [key: string]: any;
    },
  ) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }

  // --- Chat Actions (Typing, Reactions, etc.) ---
  @SubscribeMessage('typing_start')
  handleTypingStart(
    @MessageBody() payload: { conversationId: string; recipientId: string },
    @ConnectedSocket() client: SocketWithAuth,
  ) {
    this.server.to(`user:${payload.recipientId}`).emit('user_typing', {
      userId: client.data.user.sub,
      conversationId: payload.conversationId,
    });
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @MessageBody() payload: { conversationId: string; recipientId: string },
  ) {
    this.server.to(`user:${payload.recipientId}`).emit('user_stopped_typing', {
      conversationId: payload.conversationId,
    });
  }

  @SubscribeMessage('send_reaction')
  async handleSendReaction(
    @MessageBody()
    payload: {
      messageId: string;
      recipientId: string;
      reaction: string;
    },
    @ConnectedSocket() client: SocketWithAuth,
  ) {
    const reactionRecord = await this.chatService.addReaction(
      payload.messageId,
      client.data.user.sub,
      payload.reaction,
    );

    // Notify recipient
    this.server.to(`user:${payload.recipientId}`).emit('message_reaction', {
      messageId: payload.messageId,
      userId: client.data.user.sub,
      reaction: payload.reaction,
      id: reactionRecord.id,
    });

    // Notify sender back (so they see it confirmed/updated if needed, though optimistic UI handles it)
    // Actually, usually we emit to the conversation room. But here we seem to be using user:ID rooms.
    // So let's emit to sender too.
    this.server.to(`user:${client.data.user.sub}`).emit('message_reaction', {
      messageId: payload.messageId,
      userId: client.data.user.sub,
      reaction: payload.reaction,
      id: reactionRecord.id,
    });
  }

  @SubscribeMessage('mark_read')
  handleMarkRead(
    @MessageBody() payload: { conversationId: string; recipientId: string },
    @ConnectedSocket() client: SocketWithAuth,
  ) {
    this.server.to(`user:${payload.recipientId}`).emit('messages_read', {
      conversationId: payload.conversationId,
      userId: client.data.user.sub,
      readAt: new Date().toISOString(),
    });
  }

  /**
   * Extract JWT token from socket handshake.
   * Priority: 1) HTTP-only cookie  2) Authorization Bearer header
   */
  private extractToken(client: Socket): string | undefined {
    const cookieHeader = client.handshake.headers.cookie;

    if (cookieHeader) {
      try {
        const cookies = cookie.parse(cookieHeader);

        if (cookies[ACCESS_TOKEN_COOKIE]) {
          return cookies[ACCESS_TOKEN_COOKIE];
        }
      } catch (parseError) {
        this.logger.error(
          'Failed to parse socket handshake cookies',
          parseError,
        );
      }
    }

    // 2. Fall back to Authorization header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }
    return undefined;
  }
}
