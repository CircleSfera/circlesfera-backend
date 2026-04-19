import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// ─── Interfaces ──────────────────────────────────────────────────
interface PostViewsAggregation {
  _sum: { views: number | null };
}

interface RecentInteraction {
  createdAt: Date;
}

interface CreatorPost {
  id: string;
  caption: string | null;
  type: string;
  views: number;
  createdAt: Date;
  media: { url: string; type: string }[];
  _count: { likes: number; comments: number; bookmarks: number };
}

@Injectable()
export class CreatorService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Stats ──────────────────────────────────────────────────────

  async getStats(userId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const results = await Promise.all([
      this.prisma.post.count({
        where: { userId, type: 'POST' },
      }),
      this.prisma.post.count({
        where: { userId, type: 'FRAME' },
      }),
      this.prisma.story.count({ where: { userId } }),
      this.prisma.follow.count({
        where: { followingId: userId, status: 'ACCEPTED' },
      }),
      this.prisma.follow.count({
        where: {
          followingId: userId,
          status: 'ACCEPTED',
          createdAt: { lt: sevenDaysAgo },
        },
      }),
      this.prisma.like.count({
        where: { post: { userId } },
      }),
      this.prisma.comment.count({
        where: { post: { userId } },
      }),
      this.prisma.bookmark.count({
        where: { post: { userId } },
      }),
      this.prisma.promotion.count({
        where: { userId, status: 'active' },
      }),
      // Reach (Post views + Story views)
      this.prisma.post.aggregate({
        where: { userId },
        _sum: {
          views: true,
        },
      }) as unknown as Promise<PostViewsAggregation>,
      this.prisma.storyView.count({
        where: { story: { userId } },
      }),
      // Best time to post (Insights)
      this.prisma.like.findMany({
        where: { post: { userId }, createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      }),
      this.prisma.follow.count({
        where: { followerId: userId, status: 'ACCEPTED' },
      }),
    ]);

    const postCount = results[0];
    const frameCount = results[1];
    const storyCount = results[2];
    const followerCount = results[3];
    const followerCount7DaysAgo = results[4];
    const totalLikes = results[5];
    const totalComments = results[6];
    const totalBookmarks = results[7];
    const activePromotions = results[8];
    const postViews = results[9]?._sum?.views || 0;
    const storyViews = results[10];
    const recentLikes = results[11] as RecentInteraction[];
    const followingCount = results[12];

    const totalReach = postViews + storyViews;

    // Calculate follower growth percentage
    const followerGrowth =
      followerCount7DaysAgo > 0
        ? Math.round(
            ((followerCount - followerCount7DaysAgo) / followerCount7DaysAgo) *
              100 *
              10,
          ) / 10
        : 0;

    const engagementRate =
      followerCount > 0
        ? Math.round(
            ((totalLikes + totalComments) /
              (postCount + frameCount || 1) /
              followerCount) *
              100 *
              100,
          ) / 100
        : 0;

    // Calculate Most Active Day (Insights)
    const daysArr = [
      'Domingos',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábados',
    ];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    recentLikes.forEach((l) => {
      dayCounts[new Date(l.createdAt).getDay()]++;
    });

    const maxLikes = Math.max(...dayCounts);
    const bestDayIndex = maxLikes > 0 ? dayCounts.indexOf(maxLikes) : 0;
    const bestDay = daysArr[bestDayIndex];

    // Calculate Retention Rate (Proxy: Followers who interacted in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeFollowersCount = await this.prisma.follow.count({
      where: {
        followingId: userId,
        status: 'ACCEPTED',
        follower: {
          OR: [
            {
              likes: {
                some: { post: { userId }, createdAt: { gte: thirtyDaysAgo } },
              },
            },
            {
              comments: {
                some: { post: { userId }, createdAt: { gte: thirtyDaysAgo } },
              },
            },
          ],
        },
      },
    });

    const retentionRate =
      followerCount > 0
        ? Math.round((activeFollowersCount / followerCount) * 100)
        : 0;

    return {
      postCount,
      frameCount,
      storyCount,
      followerCount,
      followingCount,
      totalLikes,
      totalComments,
      totalBookmarks,
      activePromotions,
      engagementRate,
      followerGrowth,
      totalReach,
      insights: {
        bestDayToPost: bestDay,
        retentionRate,
      },
    };
  }

  // ─── Activity Chart ─────────────────────────────────────────────

  async getActivityChart(userId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 13);
    since.setHours(0, 0, 0, 0);

    const [likes, comments, storyViews, follows] = await Promise.all([
      this.prisma.like.findMany({
        where: { post: { userId }, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.comment.findMany({
        where: { post: { userId }, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.storyView.findMany({
        where: { story: { userId }, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.follow.findMany({
        where: {
          followingId: userId,
          status: 'ACCEPTED',
          createdAt: { gte: since },
        },
        select: { createdAt: true },
      }),
    ]);

    const days: {
      date: string;
      likes: number;
      comments: number;
      views: number;
      followers: number;
    }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      days.push({
        date: d.toISOString().slice(0, 10),
        likes: 0,
        comments: 0,
        views: 0,
        followers: 0,
      });
    }

    // Standard metric aggregations
    for (const l of likes) {
      const key = l.createdAt.toISOString().slice(0, 10);
      const entry = days.find((d) => d.date === key);
      if (entry) entry.likes++;
    }
    for (const c of comments) {
      const key = c.createdAt.toISOString().slice(0, 10);
      const entry = days.find((d) => d.date === key);
      if (entry) entry.comments++;
    }
    for (const v of storyViews) {
      const key = v.createdAt.toISOString().slice(0, 10);
      const entry = days.find((d) => d.date === key);
      if (entry) entry.views++;
    }
    for (const f of follows) {
      const key = f.createdAt.toISOString().slice(0, 10);
      const entry = days.find((d) => d.date === key);
      if (entry) entry.followers++;
    }

    return days;
  }

  // ─── Posts with Metrics ─────────────────────────────────────────

  async getPosts(userId: string, page = 1, limit = 10, type?: string) {
    const where = {
      userId,
      ...(type ? { type: type as 'POST' | 'FRAME' } : {}),
    };

    // Calculate Average Interactions for the user to determine performance
    const [stats, postsResult, total] = await Promise.all([
      this.getStats(userId),
      this.prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          caption: true,
          type: true,
          views: true,
          createdAt: true,
          media: { take: 1, select: { url: true, type: true } },
          _count: {
            select: { likes: true, comments: true, bookmarks: true },
          },
        },
      }) as unknown as Promise<CreatorPost[]>,
      this.prisma.post.count({ where }),
    ]);

    const avgInteractions =
      (stats.totalLikes + stats.totalComments) /
      (stats.postCount + stats.frameCount || 1);

    const data = postsResult.map((post) => {
      const interactions =
        (post._count?.likes || 0) + (post._count?.comments || 0);

      const avg = avgInteractions > 0 ? avgInteractions : 0;
      const performanceScore =
        avg > 0 ? Math.round((interactions / avg) * 100) : 100;

      return {
        ...post,
        performanceScore,
      };
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Stories with Metrics ───────────────────────────────────────

  async getStories(userId: string, page = 1, limit = 10) {
    const [data, total] = await Promise.all([
      this.prisma.story.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          mediaUrl: true,
          mediaType: true,
          expiresAt: true,
          createdAt: true,
          _count: { select: { views: true, reactions: true } },
        },
      }),
      this.prisma.story.count({ where: { userId } }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Promotions ─────────────────────────────────────────────────

  async getPromotions(userId: string, page = 1, limit = 10) {
    // 1. Auto-mark expired active promotions as completed
    await this.prisma.promotion.updateMany({
      where: {
        userId,
        status: 'active',
        endDate: { lt: new Date() },
      },
      data: { status: 'completed' },
    });

    // 2. Delete all cancelled promotions (cleanup)
    await this.prisma.promotion.deleteMany({
      where: { userId, status: 'cancelled' },
    });

    // 3. Fetch only active + completed, with related post/story data
    const where = {
      userId,
      status: { in: ['active', 'completed'] },
    };

    const [data, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], // active first
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.promotion.count({ where }),
    ]);

    // 4. Enrich with post/story thumbnail data
    const enriched = await Promise.all(
      data.map(async (promo) => {
        let target: {
          caption?: string | null;
          thumbnail?: string | null;
          type?: string;
        } | null = null;

        if (promo.targetType === 'post' || promo.targetType === 'frame') {
          const post = await this.prisma.post.findUnique({
            where: { id: promo.targetId },
            select: {
              caption: true,
              type: true,
              media: { take: 1, select: { url: true, type: true } },
            },
          });
          if (post) {
            target = {
              caption: post.caption,
              thumbnail: post.media?.[0]?.url || null,
              type: post.type,
            };
          }
        } else if (promo.targetType === 'story') {
          const story = await this.prisma.story.findUnique({
            where: { id: promo.targetId },
            select: { mediaUrl: true, mediaType: true },
          });
          if (story) {
            target = {
              caption: null,
              thumbnail: story.mediaUrl,
              type: 'STORY',
            };
          }
        }

        return { ...promo, target };
      }),
    );

    return {
      data: enriched,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async createPromotion(
    userId: string,
    targetType: string,
    targetId: string,
    budget: number,
    durationDays: number,
    currency = 'USD',
  ) {
    // Validate ownership
    if (targetType === 'post' || targetType === 'frame') {
      const post = await this.prisma.post.findFirst({
        where: { id: targetId, userId },
      });
      if (!post) throw new Error('Post not found or not owned by user');
    } else if (targetType === 'story') {
      const story = await this.prisma.story.findFirst({
        where: { id: targetId, userId },
      });
      if (!story) throw new Error('Story not found or not owned by user');
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    return this.prisma.promotion.create({
      data: {
        userId,
        targetType: targetType as 'post' | 'frame' | 'story',
        targetId,
        budget,
        currency,
        endDate,
        status: 'active',
      },
    });
  }

  async cancelPromotion(userId: string, promotionId: string) {
    const promo = await this.prisma.promotion.findFirst({
      where: { id: promotionId, userId },
    });
    if (!promo) throw new Error('Promotion not found');
    if (promo.status === 'completed') {
      throw new Error('Cannot cancel completed promotion');
    }

    // Permanently delete cancelled promotions
    return this.prisma.promotion.delete({
      where: { id: promotionId },
    });
  }
}
