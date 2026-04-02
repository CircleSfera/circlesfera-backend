import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AIService } from '../ai.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Processor('ai-processing')
export class AIProcessor extends WorkerHost {
  private readonly logger = new Logger(AIProcessor.name);

  constructor(
    private readonly aiService: AIService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(
    job: Job<{ postId: string; text: string }, any, string>,
  ): Promise<any> {
    switch (job.name) {
      case 'generate-embedding':
        return this.handleGenerateEmbedding(job);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleGenerateEmbedding(
    job: Job<{ postId: string; text: string }, any, string>,
  ) {
    const { postId, text } = job.data;
    this.logger.log(`Processing embedding for post: ${postId}`);

    try {
      const embedding = await this.aiService.generateEmbedding(text);

      await this.prisma.$executeRaw`
        INSERT INTO post_embeddings ("postId", vector)
        VALUES (${postId}, ${JSON.stringify(embedding)}::vector)
        ON CONFLICT ("postId") 
        DO UPDATE SET vector = EXCLUDED.vector
      `;

      this.logger.log(`Successfully updated embedding for post: ${postId}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to process embedding for post ${postId}: ${errorMessage}`,
      );
      throw error;
    }
  }
}
