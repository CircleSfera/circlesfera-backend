import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { User, Profile } from '@prisma/client';

// Manual definition to resolve persistent IDE type errors
export interface StoryReaction {
  id: string;
  storyId: string;
  userId: string;
  reaction: string;
  createdAt: Date;
}

export type StoryReactionWithUser = StoryReaction & {
  user: User & {
    profile: Profile | null;
  };
};

// Local definition to satisfy IDE if @prisma/client is stale
export interface StoryView {
  id: string;
  storyId: string;
  viewerId: string;
  createdAt: Date;
}

/**
 * Service for ephemeral stories (24h expiry), story views, and reactions.
 * Supports close-friends-only visibility and tracks unique view counts.
 */
@Injectable()
export class StoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new ephemeral story with a 24-hour expiry.
   * @param userId - The author's user ID
   * @param dto - Story data (mediaUrl, mediaType, isCloseFriendsOnly, audioId)
   */
  async create(userId: string, dto: CreateStoryDto) {
    const story = await this.prisma.story.create({
      data: {
        userId,
        mediaUrl: dto.mediaUrl,
        mediaType: dto.mediaType || 'image',
        isCloseFriendsOnly: dto.isCloseFriendsOnly || false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        audioId: dto.audioId,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    return story;
  }

  /**
   * Retrieve all active (non-expired) stories, optionally filtered to followed users.
   * Respects close-friends visibility permissions.
   * @param userId - Optional current user ID for personalized filtering
   */
  async findAll(userId?: string) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Build where clause
    const whereClause: {
      expiresAt: { gt: Date };
      createdAt: { gt: Date };
      userId?: { in: string[] };
    } = {
      expiresAt: { gt: new Date() },
      createdAt: { gt: oneDayAgo },
    };

    // If userId is provided, filter to show only stories from followed users
    if (userId) {
      const following = await this.prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      });
      const followingIds = following.map(
        (f: { followingId: string }) => f.followingId,
      );
      // Include the user's own stories as well
      followingIds.push(userId);
      whereClause.userId = { in: followingIds };
    }

    const stories = await this.prisma.story.findMany({
      where: whereClause,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Check Close Friends permission
    if (userId) {
      const allowedStories = await Promise.all(
        stories.map(async (story) => {
          if (!story.isCloseFriendsOnly) return story;
          if (story.userId === userId) return story; // Own story

          // Check if viewer is in story owner's close friends
          const isCloseFriend = await this.prisma.closeFriend.findUnique({
            where: {
              userId_friendId: {
                userId: story.userId,
                friendId: userId,
              },
            },
          });
          return isCloseFriend ? story : null;
        }),
      );

      return allowedStories.filter((s) => s !== null);
    }

    // If no userId (guest), only public stories (not close friends)
    return stories.filter((s) => !s.isCloseFriendsOnly);
  }

  /**
   * Retrieve active stories by a specific user's username.
   * @param username - The profile username to look up
   * @returns Array of active stories or empty array if user not found
   */
  async findByUser(username: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { username },
    });

    if (!profile) {
      return [];
    }

    const stories = await this.prisma.story.findMany({
      where: {
        userId: profile.userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return stories;
  }

  /**
   * Delete a story (author only, enforced by compound where clause).
   * @param id - The story ID
   * @param userId - The requesting user's ID
   */
  async delete(id: string, userId: string): Promise<void> {
    await this.prisma.story.deleteMany({
      where: {
        id,
        userId,
      },
    });
  }

  /**
   * Record a story view. Idempotent — returns existing view if already viewed.
   * @param id - The story ID
   * @param userId - The viewer's user ID
   * @returns The story view record
   */
  async view(id: string, userId: string): Promise<StoryView> {
    const existingView = await this.prisma.storyView.findUnique({
      where: {
        storyId_viewerId: {
          storyId: id,
          viewerId: userId,
        },
      },
    });

    if (existingView) return existingView;

    const newView = await this.prisma.storyView.create({
      data: {
        storyId: id,
        viewerId: userId,
      },
    });

    return newView;
  }

  /**
   * Get all viewers of a story with their profiles.
   * @param id - The story ID
   * @returns Array of users who viewed the story
   */
  async getViews(id: string): Promise<(User & { profile: Profile | null })[]> {
    const views = await this.prisma.storyView.findMany({
      where: { storyId: id },
      include: {
        viewer: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return views.map((v) => v.viewer);
  }

  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

  /**
   * Add or update a reaction on a story. Upserts by storyId+userId.
   * @param storyId - The story ID
   * @param userId - The reacting user's ID
   * @param reaction - The emoji/reaction string
   */
  async addReaction(
    storyId: string,
    userId: string,
    reaction: string,
  ): Promise<StoryReaction> {
    const delegate = (this.prisma as any).storyReaction;
    const existing = (await delegate.findUnique({
      where: {
        storyId_userId: {
          storyId,
          userId,
        },
      },
    })) as StoryReaction | null;

    if (existing) {
      return (await delegate.update({
        where: { id: existing.id },
        data: { reaction },
      })) as StoryReaction;
    }

    return (await delegate.create({
      data: {
        storyId,
        userId,
        reaction,
      },
    })) as StoryReaction;
  }

  /**
   * Get all reactions for a story with reactor profiles.
   * @param storyId - The story ID
   */
  async getReactions(storyId: string): Promise<StoryReactionWithUser[]> {
    const delegate = (this.prisma as any).storyReaction;
    return (await delegate.findMany({
      where: { storyId },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    })) as StoryReactionWithUser[];
  }

  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
}
