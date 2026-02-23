import { Module, Global } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatModule } from '../chat/chat.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
    ChatModule,
  ],
  providers: [AppGateway],
  exports: [AppGateway],
})
export class SocketModule {}
