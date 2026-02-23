import * as dotenv from 'dotenv';
dotenv.config();

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProfilesModule } from './profiles/profiles.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';
import { LikesModule } from './likes/likes.module';
import { FollowsModule } from './follows/follows.module';
import { StoriesModule } from './stories/stories.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ChatModule } from './chat/chat.module';
import { SearchModule } from './search/search.module';
import { UploadsModule } from './uploads/uploads.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { HighlightsModule } from './highlights/highlights.module';
import { CloseFriendsModule } from './close-friends/close-friends.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { SocketModule } from './socket/socket.module';
import { AIModule } from './ai/ai.module';
import { AudioModule } from './audio/audio.module';
import { EmailModule } from './email/email.module';
import { AdminModule } from './admin/admin.module';
import { RedisCacheModule } from './common/cache/cache.module';
import { BullModule } from '@nestjs/bullmq';

import { CsrfController } from './common/csrf/csrf.controller';

@Module({
  imports: [
    RedisCacheModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: configService.get<number>('REDIS_PORT') || 6379,
        },
      }),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: 1000, // 1 second
            limit: config.get<number>('THROTTLE_SHORT_LIMIT') || 100,
          },
          {
            name: 'medium',
            ttl: 60000, // 1 minute
            limit: config.get<number>('THROTTLE_MEDIUM_LIMIT') || 1000,
          },
          {
            name: 'long',
            ttl: 3600000, // 1 hour
            limit: config.get<number>('THROTTLE_LONG_LIMIT') || 5000,
          },
        ],
      }),
    }),
    PrismaModule,
    AuthModule,
    ProfilesModule,
    PostsModule,
    CommentsModule,
    LikesModule,
    FollowsModule,
    StoriesModule,
    NotificationsModule,
    ChatModule,
    SearchModule,
    UploadsModule,
    BookmarksModule,
    ...(process.env.CLOUDINARY_NAME
      ? []
      : [
          ServeStaticModule.forRoot({
            rootPath: join(process.cwd(), 'uploads'),
            serveRoot: '/uploads',
          }),
        ]),
    HighlightsModule,
    CloseFriendsModule,
    ReportsModule,
    UsersModule,
    SocketModule,
    AIModule,
    AudioModule,
    EmailModule,
    AdminModule,
  ],
  controllers: [AppController, CsrfController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
