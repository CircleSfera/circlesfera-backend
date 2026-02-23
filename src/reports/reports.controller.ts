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
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import type { Report } from '../types/prisma';

/** REST controller for content/user reports. Auth required; admin-only for list/update. */
@Controller('api/v1/reports')
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
