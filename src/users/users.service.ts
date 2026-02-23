import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Service for user management: follow suggestions, banning, and unbanning.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get follow suggestions for a user. Excludes already-followed, pending,
   * and blocked users, then ranks by follower count.
   * @param userId - The current user's ID
   * @param limit - Maximum suggestions to return (default 10)
   */
  async getSuggestions(userId: string, limit = 10) {
    // 1. Get IDs of users currently followed by the current user
    const following = await this.prisma.follow.findMany({
      where: {
        followerId: userId,
        status: 'ACCEPTED', // Only exclude accepted follows? Or pending too?
      },
      select: {
        followingId: true,
      },
    });

    const followingIds = following.map((f) => f.followingId);

    // 2. Get IDs of users pending (optional, maybe we suggest them until accepted?)
    // Let's exclude pending too to avoid re-requesting
    const pending = await this.prisma.follow.findMany({
      where: {
        followerId: userId,
        status: 'PENDING',
      },
      select: {
        followingId: true,
      },
    });

    const pendingIds = pending.map((p) => p.followingId);

    // 3. Get IDs of blocked users (both directions)
    const blocks = await this.prisma.block.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
      select: {
        blockerId: true,
        blockedId: true,
      },
    });

    const blockedIds = blocks.flatMap((b) => [b.blockerId, b.blockedId]);

    // 4. Combine all excluded IDs (self + following + pending + blocked)
    const excludedIds = [userId, ...followingIds, ...pendingIds, ...blockedIds];

    // 5. Fetch popular users not in excluded list
    // Improve this later with "Mutual Friends" logic if feasible
    const suggestions = await this.prisma.user.findMany({
      where: {
        id: {
          notIn: excludedIds,
        },
        isActive: true, // Only active users
        profile: {
          isNot: null, // Ensure they have a profile
        },
      },
      take: limit,
      orderBy: {
        followers: {
          _count: 'desc',
        },
      },
      include: {
        profile: {
          select: {
            username: true,
            fullName: true,
            avatar: true,
            bio: true,
          },
        },
        _count: {
          select: {
            followers: true,
          },
        },
      },
    });

    // Remap to cleaner structure
    return suggestions.map((user) => ({
      id: user.id,
      username: user.profile?.username,
      fullName: user.profile?.fullName,
      avatar: user.profile?.avatar,
      bio: user.profile?.bio,
      followersCount: user._count.followers,
      reason: 'Popular', // Placeholder for recommendation reason
    }));
  }

  /**
   * Ban (deactivate) a user account. Admin only.
   * @param id - The user ID to ban
   */
  async banUser(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Unban (reactivate) a user account. Admin only.
   * @param id - The user ID to unban
   */
  async unbanUser(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: true },
    });
  }
}
