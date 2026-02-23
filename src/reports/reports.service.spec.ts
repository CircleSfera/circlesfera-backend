import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CreateReportDto } from './dto/create-report.dto';

describe('ReportsService', () => {
  let service: ReportsService;

  const mockPrismaService = {
    report: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a report', async () => {
    const dto = {
      targetType: 'POST',
      targetId: 'post-1',
      reason: 'SPAM',
      details: 'Many spam comments',
    };
    mockPrismaService.report.create.mockResolvedValue({ id: '1', ...dto });

    const result = await service.create('user-1', dto as CreateReportDto);
    expect(result.id).toBe('1');
    expect(mockPrismaService.report.create).toHaveBeenCalled();
  });

  it('should find all reports', async () => {
    mockPrismaService.report.findMany.mockResolvedValue([{ id: '1' }]);
    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(mockPrismaService.report.findMany).toHaveBeenCalled();
  });

  it('should update report status', async () => {
    mockPrismaService.report.update.mockResolvedValue({
      id: '1',
      status: 'RESOLVED',
    });
    const result = await service.update('1', 'RESOLVED');
    expect(result.status).toBe('RESOLVED');
    expect(mockPrismaService.report.update).toHaveBeenCalled();
  });
});
