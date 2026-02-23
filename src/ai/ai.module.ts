import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AIService } from './ai.service';
import { AIProcessor } from './processors/ai.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'ai-processing',
    }),
  ],
  providers: [AIService, AIProcessor],
  exports: [AIService, BullModule],
})
export class AIModule {}
