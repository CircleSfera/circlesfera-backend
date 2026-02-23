import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateHighlightDto } from './dto/create-highlight.dto';
import { PrismaService } from '../prisma/prisma.service';

/** Service for story highlights: permanent curated groups of expired stories. */
@Injectable()
export class HighlightsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new highlight from selected stories.
   * @param userId - The owner's user ID
   * @param createHighlightDto - Title, coverUrl, and story IDs
   */
  async create(userId: string, createHighlightDto: CreateHighlightDto) {
    const { title, coverUrl, storyIds } = createHighlightDto;

    const highlight = await this.prisma.highlight.create({
      data: {
        userId,
        title,
        coverUrl,
        stories: {
          create: storyIds.map((storyId) => ({
            story: { connect: { id: storyId } },
          })),
        },
      },
      include: {
        stories: {
          include: {
            story: true,
          },
        },
      },
    });

    return highlight;
  }

  /**
   * List all highlights for a user, ordered by creation date descending.
   * @param userId - The owner's user ID
   */
  async findAll(userId: string) {
    return this.prisma.highlight.findMany({
      where: { userId },
      include: {
        stories: {
          include: {
            story: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get a single highlight by ID, with its stories.
   * @param id - The highlight ID
   * @throws NotFoundException if highlight not found
   */
  async findOne(id: string) {
    const highlight = await this.prisma.highlight.findUnique({
      where: { id },
      include: {
        user: true,
        stories: {
          include: {
            story: true,
          },
          orderBy: {
            createdAt: 'asc', // Order stories by creation time usually
          },
        },
      },
    });

    if (!highlight) {
      throw new NotFoundException('Highlight not found');
    }

    return highlight;
  }

  /** Placeholder for highlight update (not yet implemented). */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(id: string, _userId: string) {
    return `This action updates a #${id} highlight`;
  }

  /**
   * Delete a highlight owned by the user.
   * @param id - The highlight ID
   * @param userId - The requesting user's ID (for ownership check)
   * @throws NotFoundException if highlight not found or not owned
   */
  async remove(id: string, userId: string) {
    const highlight = await this.prisma.highlight.findFirst({
      where: { id, userId },
    });

    if (!highlight) {
      throw new NotFoundException(
        'Highlight not found or you do not have permission',
      );
    }

    return this.prisma.highlight.delete({
      where: { id },
    });
  }
}
