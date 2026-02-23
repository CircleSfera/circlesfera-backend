import { Module, forwardRef } from '@nestjs/common';
import { PasskeyService } from './passkey.service';
import { PasskeyController } from './passkey.controller';
import { AuthModule } from '../auth.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [PasskeyController],
  providers: [PasskeyService],
  exports: [PasskeyService],
})
export class PasskeyModule {}
