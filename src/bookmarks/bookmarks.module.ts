import { Module } from '@nestjs/common';
import { BookmarksService } from './bookmarks.service.js';
import { BookmarksController } from './bookmarks.controller.js';

@Module({
  controllers: [BookmarksController],
  providers: [BookmarksService],
  exports: [BookmarksService],
})
export class BookmarksModule {}
