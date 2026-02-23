import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile as UploadedFileDecorator,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import type { UploadedFile } from './interfaces/uploaded-file.interface';

/** REST controller for file uploads. Accepts images and videos up to 10 MB. */
@Controller('api/v1/uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /** Upload a file (image or video, max 10 MB). Returns the public URL and type. */
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit at Multer level
    }),
  )
  async uploadFile(
    @UploadedFileDecorator(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({
            fileType:
              /(jpg|jpeg|png|gif|webp|mp4|mov|quicktime|webm|mp3|wav|m4a)$/,
          }),
        ],
      }),
    )
    file: UploadedFile,
  ): Promise<{ url: string; type: string }> {
    return await this.uploadsService.uploadFile(file);
  }
}
