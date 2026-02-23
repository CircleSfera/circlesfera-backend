import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator';

/** REST controller for comments on posts. Supports creating, listing, and deleting comments. */
@Controller('api/v1/posts/:postId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /** Create a comment or reply on a post (requires auth). */
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('postId') postId: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(postId, user.userId, dto);
  }

  /** List top-level comments with nested replies for a post. */
  @Get()
  async findByPost(
    @Param('postId') postId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.commentsService.findByPost(postId, pagination);
  }

  /** Delete a comment (author only). */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    await this.commentsService.remove(id, user.userId);
  }
}
