import { Module } from '@nestjs/common';
import { CreatorService } from './creator.service.js';
import { CreatorController } from './creator.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [CreatorController],
  providers: [CreatorService],
})
export class CreatorModule {}
