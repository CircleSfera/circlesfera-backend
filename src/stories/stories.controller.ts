import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { StoriesService } from './stories.service';
import type {
  StoryView,
  StoryReactionWithUser,
  StoryReaction,
} from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { StoryReactionDto } from './dto/story-reaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator';

/** REST controller for ephemeral stories, views, and reactions. All endpoints require authentication. */
@Controller('api/v1/stories')
@UseGuards(JwtAuthGuard)
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  /** Create a new 24-hour ephemeral story. */
  @Post()
  create(
    @CurrentUser() user: CurrentUserData,
    @Body() createStoryDto: CreateStoryDto,
  ) {
    return this.storiesService.create(user.userId, createStoryDto);
  }

  /** List all active stories (filtered by followed users). */
  @Get()
  findAll(@CurrentUser() user: CurrentUserData) {
    return this.storiesService.findAll(user.userId);
  }

  /** Get active stories by a specific user. */
  @Get('user/:username')
  findByUser(@Param('username') username: string) {
    return this.storiesService.findByUser(username);
  }

  /** Delete a story (author only). */
  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ): Promise<void> {
    return this.storiesService.delete(id, user.userId);
  }

  /** Record a view on a story (idempotent). */
  @Post(':id/view')
  async view(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ): Promise<StoryView> {
    return this.storiesService.view(id, user.userId);
  }

  /** Get all viewers of a story. */
  @Get(':id/views')
  async getViews(@Param('id') id: string) {
    return this.storiesService.getViews(id);
  }

  /** Add or update a reaction on a story. */
  @Post(':id/react')
  async react(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: StoryReactionDto,
  ): Promise<StoryReaction> {
    return this.storiesService.addReaction(id, user.userId, dto.reaction);
  }

  /** Get all reactions for a story. */
  @Get(':id/reactions')
  async getReactions(
    @Param('id') id: string,
  ): Promise<StoryReactionWithUser[]> {
    return this.storiesService.getReactions(id);
  }
}
