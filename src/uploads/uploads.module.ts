import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { STORAGE_PROVIDER } from './interfaces/storage-provider.interface';
import { CloudinaryProvider } from './providers/cloudinary.provider';
import { LocalStorageProvider } from './providers/local.provider';

import { MediaProcessorService } from './media-processor.service';

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

        const isProduction =
          configService.get<string>('NODE_ENV') === 'production';
        if (isProduction && !isCloudinaryConfigured) {
          throw new Error(
            'FATAL: Cloudinary configuration is mandatory in production for scalability.',
          );
        }

        return isCloudinaryConfigured
          ? new CloudinaryProvider(configService)
          : new LocalStorageProvider(configService);
      },
    },
  ],
  exports: [UploadsService],
})
export class UploadsModule {}
