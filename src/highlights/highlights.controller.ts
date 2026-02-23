import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { HighlightsService } from './highlights.service';
import { CreateHighlightDto } from './dto/create-highlight.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface RequestWithUser {
  user: {
    userId: string;
  };
}

/** REST controller for story highlights. Create/delete require authentication. */
@Controller('api/v1/highlights')
export class HighlightsController {
  constructor(private readonly highlightsService: HighlightsService) {}

  /** Create a new highlight from selected stories (requires auth). */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Request() req: RequestWithUser,
    @Body() createHighlightDto: CreateHighlightDto,
  ) {
    return this.highlightsService.create(req.user.userId, createHighlightDto);
  }

  /** List all highlights for a specific user. */
  @Get('user/:userId')
  findAll(@Param('userId') userId: string) {
    return this.highlightsService.findAll(userId);
  }

  /** Get a single highlight by ID. */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.highlightsService.findOne(id);
  }

  /** Delete a highlight (requires auth). */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.highlightsService.remove(req.user.userId, id);
  }
}
