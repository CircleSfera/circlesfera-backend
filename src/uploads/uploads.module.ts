import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UploadsService } from './uploads.service.js';
import { UploadsController } from './uploads.controller.js';
import { STORAGE_PROVIDER } from './interfaces/storage-provider.interface.js';
import { CloudinaryProvider } from './providers/cloudinary.provider.js';
import { LocalStorageProvider } from './providers/local.provider.js';

import { MediaProcessorService } from './media-processor.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [UploadsController],
  providers: [
    UploadsService,
    MediaProcessorService,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isCloudinaryConfigured =
          configService.get<string>('CLOUDINARY_NAME');

        return isCloudinaryConfigured
          ? new CloudinaryProvider(configService)
          : new LocalStorageProvider(configService);
      },
    },
  ],
  exports: [UploadsService],
})
export class UploadsModule {}
