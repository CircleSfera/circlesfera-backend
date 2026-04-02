import { Module, forwardRef } from '@nestjs/common';
import { PasskeyService } from './passkey.service.js';
import { PasskeyController } from './passkey.controller.js';
import { AuthModule } from '../auth.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [PasskeyController],
  providers: [PasskeyService],
  exports: [PasskeyService],
})
export class PasskeyModule {}
