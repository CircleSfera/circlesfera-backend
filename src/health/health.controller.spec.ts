import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckService,
  PrismaHealthIndicator,
  DiskHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Mock } from 'vitest';

describe('HealthController', () => {
  let controller: HealthController;
  let mockCheck: Mock;

  beforeEach(async () => {
    mockCheck = vi.fn();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: mockCheck,
          },
        },
        {
          provide: PrismaHealthIndicator,
          useValue: {
            pingCheck: vi.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: DiskHealthIndicator,
          useValue: {
            checkStorage: vi.fn(),
          },
        },
        {
          provide: MemoryHealthIndicator,
          useValue: {
            checkHeap: vi.fn(),
            checkRSS: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should call healthCheckService.check with all indicators', async () => {
      await controller.check();
      expect(mockCheck).toHaveBeenCalled();
      // Verify that it passes an array of functions
      const callArgs = mockCheck.mock.calls[0][0] as unknown[];
      expect(Array.isArray(callArgs)).toBe(true);
      expect(callArgs.length).toBe(4); // database, disk, heap, rss
    });
  });
});
