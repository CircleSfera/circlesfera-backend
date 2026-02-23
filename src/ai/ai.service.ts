import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * Service for AI-powered features using OpenAI embeddings.
 * Falls back to mock embeddings in development when OPENAI_API_KEY is absent.
 */
@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private openai: OpenAI | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.logger.warn(
        'OPENAI_API_KEY not found. AIService will operate in MOCK mode.',
      );
    }
  }

  /**
   * Generate a 1536-dimension embedding vector for the given text.
   * Uses OpenAI text-embedding-3-small in production; returns mock data otherwise.
   * @param text - The input text to embed
   * @returns A 1536-element float array
   * @throws Error if API key is missing in production
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';

    if (!this.openai) {
      if (!isProd) {
        this.logger.warn('Mocking embedding (no OpenAI client)');
        return this.getMockEmbedding();
      }
      throw new Error(
        'AI Service unavailable: OPENAI_API_KEY is missing in production.',
      );
    }

    this.logger.log(
      `Generating embedding for text: ${text.substring(0, 50)}...`,
    );

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error('Failed to generate embedding with OpenAI', error);
      if (!isProd) {
        this.logger.warn('Falling back to mock embedding due to error');
        return this.getMockEmbedding();
      }
      throw error;
    }
  }

  /** Generate a random 1536-dimension mock embedding for development use. */
  private getMockEmbedding(): number[] {
    return Array.from({ length: 1536 }, () => (Math.random() * 2 - 1) * 0.1);
  }

  /**
   * Compute cosine similarity between two vectors (pure TypeScript fallback for pgvector).
   * @param vecA - First embedding vector
   * @param vecB - Second embedding vector
   * @returns Similarity score between -1 and 1
   */
  calculateSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
