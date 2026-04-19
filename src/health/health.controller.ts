import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  PrismaHealthIndicator,
  DiskHealthIndicator,
  MemoryHealthIndicator,
  MicroserviceHealthIndicator,
  HealthCheckResult,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private prisma: PrismaService,
    private disk: DiskHealthIndicator,
    private memory: MemoryHealthIndicator,
    private microservice: MicroserviceHealthIndicator,
    private configService: ConfigService,
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    const redisHost =
      this.configService.get<string>('REDIS_HOST') || 'localhost';
    const redisPort = this.configService.get<number>('REDIS_PORT') || 6379;

    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () =>
        this.microservice.pingCheck('redis', {
          transport: Transport.REDIS,
          options: {
            host: redisHost,
            port: redisPort,
          },
        }),
      () =>
        this.disk.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }),
      () => this.memory.checkHeap('memory_heap', 1024 * 1024 * 1024), // 1GB
      () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024), // 1GB
    ]);
  }
}
