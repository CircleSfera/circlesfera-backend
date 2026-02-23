import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../socket/app.gateway';
import { Prisma } from '@prisma/client';
import {
  PaginationDto,
  createPaginatedResult,
} from '../common/dto/pagination.dto';

/**
 * Service for in-app notifications (CRUD, read status, unread count).
 * Sends real-time notifications via AppGateway WebSocket.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appGateway: AppGateway,
  ) {}

  /**
   * List all notifications for a user, paginated, newest first.
   * @param userId - The recipient user's ID
   * @param pagination - Page and limit
   */
  async findAll(userId: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { recipientId: userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            include: {
              profile: true,
            },
          },
        },
      }),
      this.prisma.notification.count({ where: { recipientId: userId } }),
    ]);

    return createPaginatedResult(notifications, total, page, limit);
  }

  /**
   * Mark a single notification as read.
   * @param id - Notification ID
   * @param userId - The recipient user's ID (for ownership check)
   */
  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, recipientId: userId },
    });

    if (!notification) {
      return null;
    }

    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  /**
   * Mark all unread notifications as read for a user.
   * @param userId - The recipient user's ID
   */
  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, read: false },
      data: { read: true },
    });
  }

  /**
   * Get the count of unread notifications.
   * @param userId - The recipient user's ID
   * @returns `{ count: number }`
   */
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { recipientId: userId, read: false },
    });

    return { count };
  }

  /**
   * Create a notification and broadcast it in real-time via WebSocket.
   * @param data - Notification payload (recipientId, senderId, type, content, optional postId)
   */
  async create(data: {
    recipientId: string;
    senderId: string;
    type: string;
    content: string;
    postId?: string;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        recipientId: data.recipientId,
        senderId: data.senderId,
        type: data.type,
        content: data.content,
        postId: data.postId,
      } as Prisma.NotificationUncheckedCreateInput,
      include: {
        sender: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Emit real-time notification
    this.appGateway.sendNotification(data.recipientId, notification);

    return notification;
  }
}
