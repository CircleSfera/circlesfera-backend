import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { ReportsController } from './reports.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AIModule } from '../ai/ai.module.js';

@Module({
  imports: [PrismaModule, AIModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
