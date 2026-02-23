import { Controller, Get, Query, UseGuards, Delete } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator';
import type { SearchHistory } from '../types/prisma';

/** REST controller for combined search, semantic search, user search, and search history. */
@Controller('api/v1/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /** Search for users and hashtags by text query. */
  @Get()
  @UseGuards(JwtAuthGuard)
  async search(
    @Query('q') query: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<any> {
    const results = await this.searchService.search(query, user.userId);
    return results;
  }

  /** AI-powered semantic search against post embeddings. */
  @Get('semantic')
  @UseGuards(JwtAuthGuard)
  async semanticSearch(@Query('q') query: string): Promise<any[]> {
    return this.searchService.semanticSearch(query);
  }

  /** Search for users by username or full name. */
  @Get('users')
  @UseGuards(JwtAuthGuard)
  async searchUsers(@Query('q') query: string): Promise<any[]> {
    return this.searchService.searchUsers(query);
  }

  /** Get the user's recent search history. */
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(
    @CurrentUser() user: CurrentUserData,
  ): Promise<SearchHistory[]> {
    return await this.searchService.getHistory(user.userId);
  }

  /** Clear the user's search history. */
  @Delete('history')
  @UseGuards(JwtAuthGuard)
  async clearHistory(@CurrentUser() user: CurrentUserData): Promise<any> {
    return await this.searchService.clearHistory(user.userId);
  }
}
