import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [TerminusModule, PrismaModule, ConfigModule],
  controllers: [HealthController],
})
export class HealthModule {}
