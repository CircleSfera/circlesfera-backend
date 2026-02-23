import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';
import { UploadedFile } from './interfaces/uploaded-file.interface';

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

    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    /* eslint-disable @typescript-eslint/no-unsafe-call */
    const sharpFn = (sharp as any).default || sharp;
    const sharpInstance = sharpFn(file.buffer);

    const processedBuffer = (await sharpInstance
      .resize({
        width: this.MAX_WIDTH,
        withoutEnlargement: true,
        fit: 'inside',
      })
      .webp({ quality: this.DEFAULT_QUALITY })
      .toBuffer()) as Buffer;
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
    /* eslint-enable @typescript-eslint/no-unsafe-call */

    return {
      buffer: processedBuffer,
      mimetype: 'image/webp',
    };
  }

  /**
   * Specifically convert to AVIF if requested (for future-proofing).
   */
  async toAvif(buffer: Buffer): Promise<Buffer> {
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    /* eslint-disable @typescript-eslint/no-unsafe-call */
    const sharpFn = (sharp as any).default || sharp;
    const result = await sharpFn(buffer).avif({ quality: 65 }).toBuffer();
    return result as Buffer;
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
    /* eslint-enable @typescript-eslint/no-unsafe-call */
  }
}
