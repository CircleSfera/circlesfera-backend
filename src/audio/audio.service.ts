import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAudioDto } from './dto/create-audio.dto';

/** Service for audio track CRUD, search, and trending retrieval. */
@Injectable()
export class AudioService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new audio track record.
   * @param dto - Audio metadata (title, artist, url, duration)
   */
  async create(dto: CreateAudioDto) {
    return await this.prisma.audio.create({
      data: dto,
    });
  }

  /** List all audio tracks, ordered by creation date descending. */
  async findAll() {
    return await this.prisma.audio.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single audio track by ID.
   * @param id - The audio track's ID
   * @throws NotFoundException if not found
   */
  async findOne(id: string) {
    const audio = await this.prisma.audio.findUnique({
      where: { id },
    });
    if (!audio) throw new NotFoundException('Audio track not found');
    return audio;
  }

  /**
   * Search audio tracks by title or artist (case-insensitive).
   * @param query - The search term
   */
  async search(query: string) {
    return await this.prisma.audio.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { artist: { contains: query, mode: 'insensitive' } },
        ],
      },
    });
  }

  /** Get the 10 most recently added audio tracks (trending). */
  async getTrending() {
    return await this.prisma.audio.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
  }
}
