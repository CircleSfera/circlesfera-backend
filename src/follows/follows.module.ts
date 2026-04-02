import { Module } from '@nestjs/common';
import { FollowsController } from './follows.controller.js';
import { FollowsService } from './follows.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [NotificationsModule],
  controllers: [FollowsController],
  providers: [FollowsService],
})
export class FollowsModule {}
