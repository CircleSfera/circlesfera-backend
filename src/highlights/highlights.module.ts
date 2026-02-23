import { Module } from '@nestjs/common';
import { HighlightsService } from './highlights.service';
import { HighlightsController } from './highlights.controller';

@Module({
  controllers: [HighlightsController],
  providers: [HighlightsService],
})
export class HighlightsModule {}
