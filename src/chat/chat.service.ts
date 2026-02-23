import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Conversation, Message, MessageReaction } from '@prisma/client';
import { AppGateway } from '../socket/app.gateway';

/**
 * Service for real-time messaging: conversations, messages, reactions, and group chats.
 * Integrates with AppGateway for WebSocket broadcast of new messages.
 */
@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => AppGateway))
    private appGateway: AppGateway,
  ) {}

  /**
   * Create a group conversation with multiple participants.
   * Re-uses an existing conversation if one already exists with the same participant set.
   * @param userId - The creator's user ID
   * @param participantIds - Array of user IDs to include
   * @param name - Optional group name
   */
  async createGroup(userId: string, participantIds: string[], name?: string) {
    const uniqueParticipantIds = Array.from(
      new Set(participantIds.filter((id) => id !== userId)),
    );

    if (uniqueParticipantIds.length === 0) {
      throw new BadRequestException(
        'Cannot create a conversation with yourself',
      );
    }

    // If only 1 other participant and no group name, treat as 1-on-1
    if (uniqueParticipantIds.length === 1 && !name) {
      const recipientId = uniqueParticipantIds[0];

      // Find existing 1-on-1
      const existing = await this.prisma.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { participants: { some: { userId } } },
            { participants: { some: { userId: recipientId } } },
          ],
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  profile: true,
                },
              },
            },
          },
        },
      });

      if (existing) return existing;

      // Create isGroup: false
      return this.prisma.conversation.create({
        data: {
          isGroup: false,
          participants: {
            create: [{ userId }, { userId: recipientId }],
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  profile: true,
                },
              },
            },
          },
        },
      });
    }

    // Otherwise create group
    const allParticipantIds = Array.from(
      new Set([userId, ...uniqueParticipantIds]),
    );

    const conversation = await this.prisma.conversation.create({
      data: {
        isGroup: true,
        name,
        participants: {
          create: allParticipantIds.map((id) => ({ userId: id })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                profile: true,
              },
            },
          },
        },
      },
    });

    return conversation;
  }

  /**
   * Send a message in an existing conversation or create a new DM conversation.
   * Broadcasts the message to all participants via WebSocket.
   * @param senderId - The sender's user ID
   * @param recipientId - Optional recipient for new DM conversations
   * @param content - Message text content
   * @param mediaUrl - Optional media attachment URL
   * @param mediaType - Optional media type (image, video, etc.)
   * @param conversationId - Optional existing conversation ID
   * @param tempId - Optional client-side temporary ID for optimistic updates
   * @param postId - Optional shared post ID
   * @returns The created message with sender profile
   */
  async sendMessage(
    senderId: string,
    recipientId: string | undefined,
    content: string,
    mediaUrl?: string,
    mediaType?: string,
    conversationId?: string,
    tempId?: string,
    postId?: string,
  ): Promise<Message> {
    let conversation;

    if (conversationId) {
      conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { participants: true },
      });

      if (!conversation) throw new NotFoundException('Conversation not found');

      // Verify participation
      const isParticipant = conversation.participants.some(
        (p) => p.userId === senderId,
      );
      if (!isParticipant) throw new ForbiddenException('Not a participant');
    } else if (recipientId) {
      // 1. Find or create 1-on-1 conversation
      conversation = await this.prisma.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { participants: { some: { userId: senderId } } },
            { participants: { some: { userId: recipientId } } },
          ],
        },
        include: { participants: true },
      });

      if (!conversation) {
        conversation = await this.prisma.conversation.create({
          data: {
            isGroup: false,
            participants: {
              create: [{ userId: senderId }, { userId: recipientId }],
            },
          },
          include: { participants: true },
        });
      }
    } else {
      throw new BadRequestException(
        'Either conversationId or recipientId is required',
      );
    }

    // 2. Create message
    const message = await this.prisma.message.create({
      data: {
        content,
        senderId,
        conversationId: conversation.id,
        mediaUrl,
        mediaType,
        postId,
      },
      include: {
        sender: {
          select: {
            id: true,
            profile: {
              select: { username: true, avatar: true },
            },
          },
        },
        post: {
          include: {
            media: true,
            user: {
              include: { profile: true },
            },
          },
        },
      },
    });

    // 3. Emit real-time event to ALL participants
    conversation.participants.forEach((p) => {
      this.appGateway.server
        .to(`user:${p.userId}`)
        .emit('receiveMessage', { ...message, tempId });
    });

    return message;
  }

  /**
   * Mark all messages in a conversation as read for a specific user.
   * @param conversationId - The conversation ID
   * @param userId - The user marking messages as read
   */
  async markAsRead(conversationId: string, userId: string) {
    await this.prisma.participant.updateMany({
      where: {
        conversationId,
        userId,
      },
      data: {
        lastReadAt: new Date(),
      },
    });
  }

  /**
   * Retrieve all conversations for a user, sorted by last activity.
   * Includes the last message and participant profiles.
   * @param userId - The authenticated user's ID
   * @returns Array of conversations with participants and last message
   */
  async getConversations(userId: string): Promise<Conversation[]> {
    // Find all conversations where the user is a participant
    return await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                profile: {
                  select: {
                    username: true,
                    avatar: true,
                    fullName: true,
                  },
                },
              },
            },
          },
        },
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  /**
   * Retrieve messages for a conversation with pagination.
   * Validates the user is a participant before returning messages.
   * @param conversationId - The conversation ID
   * @param limit - Maximum number of messages to return (default 50)
   * @param userId - Optional user ID for participant validation
   * @returns Array of messages ordered by creation time (ascending)
   * @throws ForbiddenException if user is not a participant
   */
  async getMessages(
    conversationId: string,
    limit = 50,
    userId?: string,
  ): Promise<Message[]> {
    if (userId) {
      const isParticipant = await this.prisma.participant.findFirst({
        where: {
          conversationId,
          userId,
        },
      });

      if (!isParticipant) {
        throw new ForbiddenException(
          'You are not a participant in this conversation',
        );
      }
    }

    return await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            profile: {
              select: { username: true, avatar: true },
            },
          },
        },
      },
    });
  }

  /**
   * Add or update a reaction (emoji) on a message.
   * Upserts: creates a new reaction or updates the existing one.
   * @param messageId - The message to react to
   * @param userId - The reacting user's ID
   * @param reaction - The emoji/reaction string
   * @returns The created or updated reaction
   */
  async addReaction(
    messageId: string,
    userId: string,
    reaction: string,
  ): Promise<MessageReaction> {
    // Check if reaction exists
    const existing = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
    });

    if (existing) {
      return await this.prisma.messageReaction.update({
        where: { id: existing.id },
        data: { reaction },
      });
    }

    return await this.prisma.messageReaction.create({
      data: {
        messageId,
        userId,
        reaction,
      },
    });
  }

  /**
   * Delete a conversation for a user. Only participants can delete.
   * @param conversationId - The conversation ID to delete
   * @param userId - The requesting user's ID
   * @throws NotFoundException if conversation not found
   * @throws ForbiddenException if user is not a participant
   */
  async deleteConversation(conversationId: string, userId: string) {
    const isParticipant = await this.prisma.participant.findFirst({
      where: {
        conversationId,
        userId,
      },
    });

    if (!isParticipant) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    // Emit deletion event to participants
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });

    if (conversation) {
      conversation.participants.forEach((p) => {
        this.appGateway.server
          .to(`user:${p.userId}`)
          .emit('conversationDeleted', { conversationId });
      });
    }

    // Delete conversation (cascades to participants and messages)
    return await this.prisma.conversation.delete({
      where: { id: conversationId },
    });
  }
}
