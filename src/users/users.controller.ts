import {
  Controller,
  Get,
  UseGuards,
  Query,
  Patch,
  Param,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';

/** REST controller for user management and follow suggestions. */
@Controller('api/v1/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Get suggested users to follow based on popularity. */
  @Get('suggestions')
  async getSuggestions(
    @CurrentUser() user: CurrentUserData,
    @Query('limit') limit?: string,
  ): Promise<any[]> {
    return this.usersService.getSuggestions(
      user.userId,
      limit ? parseInt(limit) : 10,
    );
  }
  /** Ban a user (admin only). */
  @Patch(':id/ban')
  @UseGuards(AdminGuard)
  async banUser(@Param('id') id: string) {
    return this.usersService.banUser(id);
  }

  /** Unban a user (admin only). */
  @Patch(':id/unban')
  @UseGuards(AdminGuard)
  async unbanUser(@Param('id') id: string) {
    return this.usersService.unbanUser(id);
  }
}
