import {
  Controller,
  Get,
  UseGuards,
  Query,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator.js';
import { AdminGuard } from '../auth/guards/admin.guard.js';

/** REST controller for user management and follow suggestions. */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Get suggested users to follow based on popularity. */
  @Get('suggestions')
  async getSuggestions(
    @CurrentUser() user: CurrentUserData,
    @Query('limit') limit?: string,
  ): Promise<Record<string, unknown>[]> {
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

  /** GDPR: Export all user data as JSON. */
  @Get('gdpr/export')
  async exportData(
    @CurrentUser() user: CurrentUserData,
  ): Promise<Record<string, unknown>> {
    return this.usersService.exportUserData(user.userId);
  }

  /** GDPR: Full account deletion (irreversible). */
  @Delete('gdpr/account')
  async deleteAccount(@CurrentUser() user: CurrentUserData) {
    await this.usersService.deleteUser(user.userId);
    return { message: 'Account deleted successfully' };
  }
}
