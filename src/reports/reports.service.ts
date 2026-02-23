import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import type { Report } from '../types/prisma';

/** Service for content/user reports: creation, listing, and status updates. */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * File a new report against a user or content.
   * @param reporterId - The reporting user's ID
   * @param dto - Report details (targetType, targetId, reason, details)
   */
  async create(reporterId: string, dto: CreateReportDto): Promise<Report> {
    return (await this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        details: dto.details,
      },
    })) as Report;
  }

  /** List all reports with reporter profiles (admin only). */
  async findAll(): Promise<Report[]> {
    const reports = await this.prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: {
          include: { profile: true },
        },
      },
    });
    return reports as unknown as Report[];
  }

  /**
   * Update a report's status (e.g. pending → resolved).
   * @param id - The report ID
   * @param status - The new status value
   */
  async update(id: string, status: string): Promise<Report> {
    return (await this.prisma.report.update({
      where: { id },
      data: { status },
    })) as Report;
  }
}
