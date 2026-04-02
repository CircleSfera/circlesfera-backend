import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { UploadedFile } from './interfaces/uploaded-file.interface.js';

@Injectable()
export class MediaProcessorService {
  private readonly MAX_WIDTH = 1920;
  private readonly DEFAULT_QUALITY = 80;

  /**
   * Processes an image file: resizes, converts to format, and strips metadata.
   * If not an image, returns original buffer.
   */
  async process(
    file: UploadedFile,
  ): Promise<{ buffer: Buffer; mimetype: string }> {
    if (!file.mimetype.startsWith('image/')) {
      return { buffer: file.buffer, mimetype: file.mimetype };
    }

    // SVG and GIFs (animated) are passed through for now to avoid breaking animations
    if (file.mimetype === 'image/svg+xml' || file.mimetype === 'image/gif') {
      return { buffer: file.buffer, mimetype: file.mimetype };
    }

    const sharpInstance = sharp(file.buffer);

    const processedBuffer = await sharpInstance
      .resize({
        width: this.MAX_WIDTH,
        withoutEnlargement: true,
        fit: 'inside',
      })
      .webp({ quality: this.DEFAULT_QUALITY })
      .toBuffer();

    return {
      buffer: processedBuffer,
      mimetype: 'image/webp',
    };
  }

  /**
   * Specifically convert to AVIF if requested (for future-proofing).
   */
  async toAvif(buffer: Buffer): Promise<Buffer> {
    const result = await sharp(buffer).avif({ quality: 65 }).toBuffer();
    return result;
  }
}
