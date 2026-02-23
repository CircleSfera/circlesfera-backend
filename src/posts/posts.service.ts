import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, PostType } from '@prisma/client';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import {
  PaginationDto,
  createPaginatedResult,
} from '../common/dto/pagination.dto';

import { NotificationsService } from '../notifications/notifications.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/**
 * Core service for post CRUD, feed generation, pagination, and hashtag/mention extraction.
 * Integrates with BullMQ for async AI embedding and NotificationsService for mention alerts.
 */
@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @InjectQueue('ai-processing') private readonly aiQueue: Queue,
  ) {}

  /**
   * Create a new post with media, caption, hashtags, and mentions.
   * Extracts hashtags/mentions from the caption, creates notification for mentioned users,
   * and enqueues AI embedding generation via BullMQ.
   * @param userId - The author's user ID
   * @param dto - Post creation data (caption, mediaUrl, mediaType, etc.)
   * @returns The created post with user profile and engagement counts
   */
  async create(userId: string, dto: CreatePostDto) {
    // Extract hashtags and mentions
    // Extract hashtags and mentions with ReDoS-safe, robust patterns
    // Using word boundaries and excluding URLs/emails to avoid false positives
    const hashtags = dto.caption ? dto.caption.match(/(?:^|\s)(#[\w-]+)/g) : [];
    const uniqueTags = hashtags
      ? [...new Set(hashtags.map((tag) => tag.trim().slice(1).toLowerCase()))]
      : [];

    const mentions = dto.caption ? dto.caption.match(/(?:^|\s)(@[\w.]+)/g) : [];
    const uniqueMentions = mentions
      ? [...new Set(mentions.map((m) => m.trim().slice(1)))]
      : [];

    const post = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const post = await tx.post.create({
          data: {
            userId,
            caption: dto.caption,
            type: dto.type || 'POST',
            location: dto.location,
            hideLikes: dto.hideLikes,
            turnOffComments: dto.turnOffComments,
            audioId: dto.audioId,
          },
          include: {
            user: {
              include: {
                profile: true,
              },
            },
            media: true, // Include the new relation
            _count: {
              select: {
                likes: true,
                comments: true,
              },
            },
          },
        });

        // Create PostMedia entries
        if (dto.media && dto.media.length > 0) {
          await tx.postMedia.createMany({
            data: dto.media.map((item, index) => ({
              postId: post.id,
              url: item.url,
              type: item.type || 'image',
              filter: item.filter,
              altText: item.altText,
              order: index,
            })),
          });
        }
        if (uniqueTags.length > 0) {
          for (const tag of uniqueTags) {
            const hashtag = await tx.hashtag.upsert({
              where: { tag },
              create: { tag, postCount: 1 },
              update: { postCount: { increment: 1 } },
            });

            await tx.postHashtag.create({
              data: {
                postId: post.id,
                hashtagId: hashtag.id,
              },
            });
          }
        }

        return post;
      },
      // Increase timeout for transaction if needed, but default is usually fine
    );

    // Generate and store embedding for the post in the background
    await this.aiQueue.add('generate-embedding', {
      postId: post.id,
      text: dto.caption || '',
    });

    // Handle Mentions (outside transaction to avoid blocking)
    if (uniqueMentions.length > 0) {
      // Find users mentioned
      const profiles = await this.prisma.profile.findMany({
        where: {
          username: { in: uniqueMentions },
          userId: { not: userId }, // Don't notify self
        },
        select: { userId: true },
      });

      // Create notifications
      await Promise.all(
        profiles.map((profile) =>
          this.notificationsService.create({
            recipientId: profile.userId,
            senderId: userId,
            type: 'mention',
            content: `mentioned you in a post`,
          }),
        ),
      );
    }

    return post;
  }

  /**
   * Retrieve posts filtered by hashtag with pagination.
   * @param tag - The hashtag to filter by (without #)
   * @param pagination - Page and limit parameters
   * @returns Paginated list of posts containing the given hashtag
   */
  async getByTag(tag: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          hashtags: {
            some: {
              hashtag: {
                tag: tag.toLowerCase(),
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          media: true,
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
      }),
      this.prisma.post.count({
        where: {
          hashtags: {
            some: {
              hashtag: {
                tag: tag.toLowerCase(),
              },
            },
          },
        },
      }),
    ]);

    return createPaginatedResult(posts, total, page, limit);
  }

  /**
   * List all posts with optional sorting (latest/trending) and pagination.
   * Enriches each post with `isLiked` and `isBookmarked` flags for the current user.
   * @param pagination - Page and limit parameters
   * @param sort - Sort order: 'latest' (default) or 'trending' (by like count)
   * @param currentUserId - Optional current user for engagement flags
   */
  async findAll(
    pagination: PaginationDto,
    sort: 'latest' | 'trending' = 'latest',
    currentUserId?: string,
  ) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const orderBy: Prisma.PostOrderByWithRelationInput =
      sort === 'trending'
        ? { likes: { _count: 'desc' } }
        : { createdAt: 'desc' };

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { type: 'POST' }, // Only show standard posts
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          media: true,
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
          likes: currentUserId
            ? { where: { userId: currentUserId }, take: 1 }
            : false,
        },
      }),
      this.prisma.post.count({ where: { type: 'POST' } }),
    ]);

    const formattedPosts = posts.map((post) => {
      const { likes, ...rest } = post;
      return {
        ...rest,
        isLiked: currentUserId ? (likes as any[]).length > 0 : false,
      };
    });

    return createPaginatedResult(formattedPosts, total, page, limit);
  }

  /**
   * Retrieve a video-only feed (Frames/Reels) with pagination.
   * @param pagination - Page and limit parameters
   * @param currentUserId - Optional current user for engagement flags
   */
  async getFramesFeed(pagination: PaginationDto, currentUserId?: string) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    // Frames are usually randomized or trending, for now we will just show latest frames globally
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { type: 'FRAME' },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          media: true,
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
          likes: currentUserId
            ? { where: { userId: currentUserId }, take: 1 }
            : false,
        },
      }),
      this.prisma.post.count({ where: { type: 'FRAME' } }),
    ]);

    const formattedPosts = posts.map((post) => {
      const { likes, ...rest } = post;
      return {
        ...rest,
        isLiked: currentUserId ? (likes as any[]).length > 0 : false,
      };
    });

    return createPaginatedResult(formattedPosts, total, page, limit);
  }

  /**
   * Retrieve a single post by ID with full relations and engagement flags.
   * @param id - The post's unique identifier
   * @param currentUserId - Optional current user for isLiked/isBookmarked
   * @throws NotFoundException if the post does not exist
   */
  async findOne(id: string, currentUserId?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
        likes: currentUserId
          ? { where: { userId: currentUserId }, take: 1 }
          : false,
        media: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const { likes, ...rest } = post;
    return {
      ...rest,
      isLiked: currentUserId
        ? (likes as { userId: string }[]).length > 0
        : false,
    };
  }

  /**
   * Retrieve posts by a specific user's username with optional type filter.
   * @param username - The profile username to look up
   * @param pagination - Page and limit parameters
   * @param type - Optional filter by PostType (post, reel, frame)
   * @param currentUserId - Optional current user for engagement flags
   */
  async findByUser(
    username: string,
    pagination: PaginationDto,
    type?: PostType,
    currentUserId?: string,
  ) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const profile = await this.prisma.profile.findUnique({
      where: { username },
    });

    if (!profile) {
      throw new NotFoundException('User not found');
    }

    const whereClause: Prisma.PostWhereInput = {
      userId: profile.userId,
    };

    if (type) {
      whereClause.type = type;
    }

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          media: true,
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
          likes: currentUserId
            ? { where: { userId: currentUserId }, take: 1 }
            : false,
        },
      }),
      this.prisma.post.count({ where: whereClause }),
    ]);

    const formattedPosts = posts.map((post) => {
      const { likes, ...rest } = post;
      return {
        ...rest,
        isLiked: currentUserId ? (likes as any[]).length > 0 : false,
      };
    });

    return createPaginatedResult(formattedPosts, total, page, limit);
  }

  /**
   * Retrieve posts where a user has been tagged/mentioned.
   * @param username - The tagged user's username
   * @param pagination - Page and limit parameters
   */
  async getTaggedPosts(username: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const profile = await this.prisma.profile.findUnique({
      where: { username },
    });

    if (!profile) {
      throw new NotFoundException('User not found');
    }

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          tags: {
            some: {
              userId: profile.userId,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          media: true,
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
      }),
      this.prisma.post.count({
        where: {
          tags: {
            some: {
              userId: profile.userId,
            },
          },
        },
      }),
    ]);

    return createPaginatedResult(posts, total, page, limit);
  }

  /**
   * Generate a personalized feed from posts by followed users, ordered chronologically.
   * @param userId - The authenticated user's ID
   * @param pagination - Page and limit parameters
   */
  async getFeed(userId: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    // Get users that the current user follows
    const following = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = following.map(
      (f: { followingId: string }) => f.followingId,
    );
    followingIds.push(userId); // Include own posts

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          userId: { in: followingIds },
          type: 'POST', // Only standard posts in main feed
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          media: true,
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
      }),
      this.prisma.post.count({
        where: { userId: { in: followingIds }, type: 'POST' },
      }),
    ]);

    return createPaginatedResult(posts, total, page, limit);
  }

  /**
   * Update a post's caption and media. Only the author can update.
   * @param id - The post ID
   * @param userId - The requesting user's ID (must be the author)
   * @param dto - Updated post data
   * @throws NotFoundException if post not found
   * @throws ForbiddenException if user is not the author
   */
  async update(id: string, userId: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({ where: { id } });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.userId !== userId) {
      throw new ForbiddenException('You can only update your own posts');
    }

    return this.prisma.post.update({
      where: { id },
      data: dto,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
        media: true,
      },
    });
  }

  /**
   * Delete a post. Only the author can delete their own posts.
   * @param id - The post ID
   * @param userId - The requesting user's ID (must be the author)
   * @throws NotFoundException if post not found
   * @throws ForbiddenException if user is not the author
   */
  async remove(id: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.userId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.prisma.post.delete({ where: { id } });
  }

  /**
   * Admin-only post deletion (bypasses ownership check).
   * @param id - The post ID to remove
   * @throws NotFoundException if post not found
   */
  async adminRemove(id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    await this.prisma.post.delete({ where: { id } });
  }
}
