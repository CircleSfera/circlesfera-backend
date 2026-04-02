import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AudioModule } from '../audio/audio.module.js';

@Module({
  imports: [PrismaModule, AudioModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
