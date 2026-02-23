import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  Body,
  Patch,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { BookmarksService } from './bookmarks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator';

/** REST controller for bookmark management. All endpoints require authentication. */
@Controller('api/v1/bookmarks')
@UseGuards(JwtAuthGuard)
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  /** Toggle bookmark on/off for a post, optionally assigning to a collection. */
  @Post(':postId')
  toggle(
    @CurrentUser() user: CurrentUserData,
    @Param('postId') postId: string,
    @Body('collectionId') collectionId?: string,
  ) {
    return this.bookmarksService.toggle(user.userId, postId, collectionId);
  }

  /** Move a bookmarked post to a different collection. */
  @Patch(':postId/collection')
  updateCollection(
    @CurrentUser() user: CurrentUserData,
    @Param('postId') postId: string,
    @Body('collectionId') collectionId: string,
  ) {
    return this.bookmarksService.updateCollection(
      user.userId,
      postId,
      collectionId,
    );
  }

  /** List all bookmarked posts (paginated, optionally filtered by collection). */
  @Get()
  getBookmarks(
    @CurrentUser() user: CurrentUserData,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('collectionId') collectionId?: string,
  ) {
    return this.bookmarksService.getBookmarks(
      user.userId,
      Number(page),
      Number(limit),
      collectionId,
    );
  }

  /** Check whether a user has bookmarked a specific post. */
  @SkipThrottle()
  @Get(':postId/check')
  check(@CurrentUser() user: CurrentUserData, @Param('postId') postId: string) {
    return this.bookmarksService.check(user.userId, postId);
  }
}
