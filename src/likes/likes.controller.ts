import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { LikesService } from './likes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator';

/** REST controller for post likes. All endpoints require authentication. */
@Controller('api/v1/posts/:postId/likes')
@UseGuards(JwtAuthGuard)
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  /** Toggle like/unlike on a post. */
  @Post('toggle')
  async toggle(
    @Param('postId') postId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.likesService.toggle(postId, user.userId);
  }

  /** Check if the current user has liked a post. */
  @SkipThrottle()
  @Get('check')
  async check(
    @Param('postId') postId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.likesService.checkLike(postId, user.userId);
  }
}
