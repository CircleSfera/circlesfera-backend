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
import { AdminQueryDto } from './dto/admin-query.dto';

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
  async getUsers(@Query() query: AdminQueryDto) {
    return this.adminService.getUsers(
      query.page ? parseInt(query.page as unknown as string) : 1,
      query.limit ? parseInt(query.limit as unknown as string) : 10,
      query.search,
    );
  }

  /** Get posts list for moderation. */
  @Get('posts')
  async getPosts(@Query() query: AdminQueryDto) {
    return this.adminService.getPosts(
      query.page ? parseInt(query.page as unknown as string) : 1,
      query.limit ? parseInt(query.limit as unknown as string) : 10,
      query.search,
    );
  }
}
