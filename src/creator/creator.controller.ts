import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  Req,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CreatorService } from './creator.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { SubscriptionGuard } from '../auth/guards/subscription.guard.js';
import { RequiresPlan } from '../auth/decorators/requires-plan.decorator.js';

interface AuthRequest extends Request {
  user: { userId: string; email: string; role: string };
}

@Controller('creator')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@RequiresPlan('Elite Creator')
export class CreatorController {
  constructor(private readonly creatorService: CreatorService) {}

  /** Creator stats for authenticated user. */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getStats(@Req() req: AuthRequest) {
    return this.creatorService.getStats(req.user.userId);
  }

  /** Activity chart (likes, comments, views per day for 14 days). */
  @Get('activity-chart')
  @HttpCode(HttpStatus.OK)
  async getActivityChart(@Req() req: AuthRequest) {
    return this.creatorService.getActivityChart(req.user.userId);
  }

  /** Paginated posts/frames with metrics. */
  @Get('posts')
  async getPosts(
    @Req() req: AuthRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    return this.creatorService.getPosts(
      req.user.userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
      type,
    );
  }

  /** Paginated stories with metrics. */
  @Get('stories')
  async getStories(
    @Req() req: AuthRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.creatorService.getStories(
      req.user.userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /** Get my promotions. */
  @Get('promotions')
  async getPromotions(
    @Req() req: AuthRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.creatorService.getPromotions(
      req.user.userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /** Create a promotion (simulated payment). */
  @Post('promotions')
  async createPromotion(
    @Req() req: AuthRequest,
    @Body()
    body: {
      targetType: string;
      targetId: string;
      budget: number;
      durationDays: number;
      currency?: string;
    },
  ) {
    if (
      !body.targetType ||
      !body.targetId ||
      !body.budget ||
      !body.durationDays
    ) {
      throw new BadRequestException('Missing required fields');
    }
    return this.creatorService.createPromotion(
      req.user.userId,
      body.targetType,
      body.targetId,
      body.budget,
      body.durationDays,
      body.currency,
    ) as Promise<unknown>;
  }

  /** Cancel a promotion. */
  @Delete('promotions/:id')
  async cancelPromotion(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.creatorService.cancelPromotion(
      req.user.userId,
      id,
    ) as Promise<unknown>;
  }
}
