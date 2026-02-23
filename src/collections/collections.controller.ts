import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator';

/** REST controller for bookmark collections. All endpoints require authentication. */
@Controller('api/v1/collections')
@UseGuards(JwtAuthGuard)
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  /** Create a new bookmark collection. */
  @Post()
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body('name') name: string,
  ): Promise<any> {
    return await this.collectionsService.create(user.userId, name);
  }

  /** List all collections for the authenticated user. */
  @Get()
  findAll(@CurrentUser() user: CurrentUserData) {
    return this.collectionsService.findAll(user.userId);
  }

  /** Get a single collection by ID. */
  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.collectionsService.findOne(user.userId, id);
  }

  /** Rename a collection. */
  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body('name') name: string,
  ) {
    return this.collectionsService.update(user.userId, id, name);
  }

  /** Delete a collection. */
  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.collectionsService.delete(user.userId, id);
  }
}
