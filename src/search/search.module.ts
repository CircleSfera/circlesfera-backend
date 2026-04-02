import { Module } from '@nestjs/common';
import { SearchService } from './search.service.js';
import { SearchController } from './search.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AIModule } from '../ai/ai.module.js';

@Module({
  imports: [PrismaModule, AIModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
