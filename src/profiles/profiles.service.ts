import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * Service for profile CRUD, username validation, and account lifecycle (deactivate/delete).
 * Uses cache-manager for profile read caching.
 */
@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Get a public profile by username. Cached for 10 minutes.
   * @param username - The profile username
   * @throws NotFoundException if profile does not exist
   */
  async getProfile(username: string) {
    const cacheKey = `profile:${username}`;
    const cachedProfile = await this.cacheManager.get(cacheKey);
    if (cachedProfile) {
      return cachedProfile;
    }

    const profile = await this.prisma.profile.findUnique({
      where: { username },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
            _count: {
              select: {
                posts: true,
                followers: true,
                following: true,
              },
            },
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    await this.cacheManager.set(cacheKey, profile, 600000); // 10 minutes
    return profile;
  }

  /**
   * Search profiles by username or full name (case-insensitive).
   * @param query - Search term
   * @returns Up to 10 matching profiles
   */
  async searchProfiles(query: string) {
    if (!query) return [];

    return this.prisma.profile.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { fullName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: {
        id: true,
        userId: true,
        username: true,
        fullName: true,
        avatar: true,
        isPrivate: true,
      },
    });
  }

  /**
   * Check whether a username is available and valid.
   * Validates format (3-30 chars, alphanumeric + dots/underscores).
   * @param username - The username to validate
   */
  async checkUsernameAvailability(
    username: string,
  ): Promise<{ available: boolean; message: string }> {
    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9._]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return {
        available: false,
        message:
          'Username must be 3-30 characters and can only contain letters, numbers, dots and underscores',
      };
    }

    // Check if username exists
    const existingProfile = await this.prisma.profile.findUnique({
      where: { username },
      select: { id: true },
    });

    if (existingProfile) {
      return {
        available: false,
        message: 'This username is already taken',
      };
    }

    return {
      available: true,
      message: 'Username is available',
    };
  }

  /**
   * Update the authenticated user's profile. Invalidates the profile cache.
   * @param userId - The user's ID
   * @param dto - Fields to update
   * @throws NotFoundException if profile not found
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const updated = await this.prisma.profile.update({
      where: { userId },
      data: dto,
    });

    // Invalidate cache
    await this.cacheManager.del(`profile:${profile.username}`);
    return updated;
  }

  /**
   * Get the authenticated user's own profile (not cached).
   * @param userId - The user's ID
   * @throws NotFoundException if profile not found
   */
  async getMyProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }

  /**
   * Deactivate the authenticated user's account (soft, reversible).
   * @param userId - The user's ID
   */
  async deactivateAccount(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const result = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
    if (profile) {
      await this.cacheManager.del(`profile:${profile.username}`);
    }
    return result;
  }

  /**
   * Mark the authenticated user's account as deleted (soft delete with timestamp).
   * @param userId - The user's ID
   */
  async deleteAccount(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    // Soft delete
    const result = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
    if (profile) {
      await this.cacheManager.del(`profile:${profile.username}`);
    }
    return result;
  }
}
