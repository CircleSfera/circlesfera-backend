import { Module } from '@nestjs/common';
import { AudioService } from './audio.service.js';
import { AudioController } from './audio.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [AudioController],
  providers: [AudioService],
  exports: [AudioService],
})
export class AudioModule {}
