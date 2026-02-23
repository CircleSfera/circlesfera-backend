import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get global platform statistics.
   */
  async getStats() {
    const [userCount, postCount, storyCount, activeReports] = await Promise.all(
      [
        this.prisma.user.count(),
        this.prisma.post.count(),
        this.prisma.story.count(),
        this.prisma.report.count({
          where: { status: 'pending' },
        }),
      ],
    );

    return {
      users: userCount,
      posts: postCount,
      stories: storyCount,
      pendingReports: activeReports,
    };
  }

  /**
   * Get paginated list of users for administration.
   */
  async getUsers(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { username: { contains: search, mode: 'insensitive' } } },
        { profile: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get paginated list of posts for moderation.
   */
  async getPosts(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;
    const where: Prisma.PostWhereInput = {};

    if (search) {
      where.OR = [
        { caption: { contains: search, mode: 'insensitive' } },
        {
          user: {
            profile: {
              username: { contains: search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            include: { profile: true },
          },
          media: true,
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      data: posts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
