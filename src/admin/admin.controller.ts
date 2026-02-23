import {
  Controller,
  Get,
  UseGuards,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** Get platform-wide statistics. */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getStats() {
    return this.adminService.getStats();
  }

  /** Get users list for administration. */
  @Get('users')
  async getUsers(
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers(
      pagination.page ? parseInt(pagination.page as unknown as string) : 1,
      pagination.limit ? parseInt(pagination.limit as unknown as string) : 10,
      search,
    );
  }

  /** Get posts list for moderation. */
  @Get('posts')
  async getPosts(
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
  ) {
    return this.adminService.getPosts(
      pagination.page ? parseInt(pagination.page as unknown as string) : 1,
      pagination.limit ? parseInt(pagination.limit as unknown as string) : 10,
      search,
    );
  }
}
