import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';
import type { Post, Profile, Hashtag } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';

export interface SearchResponse {
  users: any[];
  hashtags: Hashtag[];
}

/**
 * Service for user search, hashtag search, AI-powered semantic search, and search history.
 * Uses cache-manager for embedding caching and AIService for vector similarity.
 */
@Injectable()
export class SearchService {
  private readonly SIMILARITY_THRESHOLD = 0.7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Perform a combined search for users and hashtags. Saves search history if authenticated.
   * @param query - The search query (min 2 chars)
   * @param userId - Optional authenticated user ID for history tracking
   */
  async search(query: string, userId?: string): Promise<SearchResponse> {
    if (!query || query.length < 2) return { users: [], hashtags: [] };

    const sanitizedQuery = query.toLowerCase();

    // Save search history if userId is provided
    if (userId) {
      this.prisma.searchHistory
        .create({
          data: {
            userId,
            query: sanitizedQuery,
          },
        })
        .catch((err: unknown) => {
          console.error('Failed to save search history', err);
        });
    }

    const [users, hashtags] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          OR: [
            {
              profile: {
                username: {
                  contains: sanitizedQuery,
                  mode: 'insensitive',
                },
              },
            },
            {
              profile: {
                fullName: {
                  contains: sanitizedQuery,
                  mode: 'insensitive',
                },
              },
            },
          ],
        },
        take: 5,
        select: {
          id: true,
          profile: {
            select: {
              username: true,
              fullName: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.hashtag.findMany({
        where: {
          tag: {
            contains: sanitizedQuery,
            mode: 'insensitive',
          },
        },
        take: 5,
        orderBy: {
          postCount: 'desc',
        },
      }),
    ]);

    return { users, hashtags };
  }

  /**
   * Get the user's 10 most recent unique search queries.
   * @param userId - The authenticated user's ID
   */
  async getHistory(userId: string) {
    return this.prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      distinct: ['query'],
    });
  }

  /**
   * Clear all search history for a user.
   * @param userId - The authenticated user's ID
   */
  async clearHistory(userId: string) {
    return this.prisma.searchHistory.deleteMany({
      where: { userId },
    });
  }

  /**
   * Search for users by username or full name (case-insensitive).
   * @param query - The search query (min 2 chars)
   * @returns Up to 10 matching profiles
   */
  async searchUsers(query: string): Promise<Partial<Profile>[]> {
    if (!query || query.length < 2) return [];

    const sanitizedQuery = query.toLowerCase();

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          {
            profile: {
              username: {
                contains: sanitizedQuery,
                mode: 'insensitive',
              },
            },
          },
          {
            profile: {
              fullName: {
                contains: sanitizedQuery,
                mode: 'insensitive',
              },
            },
          },
        ],
      },
      take: 10,
      include: {
        profile: true,
      },
    });

    // Return profiles directly for easier frontend consumption
    return users.map((u) => u.profile).filter((p): p is Profile => p !== null);
  }

  /**
   * AI-powered semantic search using embedding similarity.
   * Generates an embedding for the query and compares against post embeddings.
   * @param query - The search query (min 3 chars)
   * @returns Up to 10 posts ranked by semantic similarity
   */
  async semanticSearch(query: string): Promise<Post[]> {
    if (!query || query.length < 3) return [];

    const cacheKey = `embedding:${query.toLowerCase().trim()}`;
    let queryEmbedding = await this.cacheManager.get<number[]>(cacheKey);

    if (!queryEmbedding) {
      queryEmbedding = await this.aiService.generateEmbedding(query);
      await this.cacheManager.set(cacheKey, queryEmbedding, 3600000); // 1 hour TTL
    }

    const allEmbeddings = await this.prisma.postEmbedding.findMany({
      include: {
        post: {
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
        },
      },
    });

    const results = allEmbeddings
      .map((emb) => ({
        post: emb.post,
        similarity: this.aiService.calculateSimilarity(
          queryEmbedding,
          Array.isArray(emb.vector) ? (emb.vector as number[]) : [],
        ),
      }))
      .filter((res) => res.similarity > this.SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);

    return results.map((r) => r.post);
  }
}
