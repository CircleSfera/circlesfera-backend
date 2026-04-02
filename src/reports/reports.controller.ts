import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator.js';
import { AdminGuard } from '../auth/guards/admin.guard.js';
import type { Report } from '../types/prisma.js';

/** REST controller for content/user reports. Auth required; admin-only for list/update. */
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /** File a new report. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateReportDto,
  ): Promise<Report> {
    return await this.reportsService.create(user.userId, dto);
  }

  /** List all reports (admin only). */
  @Get()
  @UseGuards(AdminGuard)
  async findAll(): Promise<any[]> {
    return this.reportsService.findAll();
  }

  /** Update a report's status (admin only). */
  @Patch(':id')
  @UseGuards(AdminGuard)
  async update(
    @Param('id') id: string,
    @Body('status') status: string,
  ): Promise<Report> {
    return this.reportsService.update(id, status);
  }
}
