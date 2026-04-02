import { Module } from '@nestjs/common';
import { CollectionsService } from './collections.service.js';
import { CollectionsController } from './collections.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [CollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
