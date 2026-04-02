import * as dotenv from 'dotenv';
dotenv.config();

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { PostsModule } from './posts/posts.module.js';
import { CommentsModule } from './comments/comments.module.js';
import { LikesModule } from './likes/likes.module.js';
import { FollowsModule } from './follows/follows.module.js';
import { StoriesModule } from './stories/stories.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ChatModule } from './chat/chat.module.js';
import { SearchModule } from './search/search.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { BookmarksModule } from './bookmarks/bookmarks.module.js';
import { HighlightsModule } from './highlights/highlights.module.js';
import { CloseFriendsModule } from './close-friends/close-friends.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { UsersModule } from './users/users.module.js';
import { SocketModule } from './socket/socket.module.js';
import { AIModule } from './ai/ai.module.js';
import { AudioModule } from './audio/audio.module.js';
import { EmailModule } from './email/email.module.js';
import { AdminModule } from './admin/admin.module.js';
import { CreatorModule } from './creator/creator.module.js';
import { RedisCacheModule } from './common/cache/cache.module.js';
import { WhitelistModule } from './whitelist/whitelist.module.js';
import { BullModule } from '@nestjs/bullmq';
import { PaymentsModule } from './payments/payments.module.js';

import { CsrfController } from './common/csrf/csrf.controller.js';

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
    CreatorModule,
    WhitelistModule,
    PaymentsModule,
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
