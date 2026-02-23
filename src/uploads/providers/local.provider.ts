import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { StorageProvider } from '../interfaces/storage-provider.interface';
import { UploadedFile } from '../interfaces/uploaded-file.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor(private readonly configService: ConfigService) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async upload(file: UploadedFile): Promise<{ url: string; type: string }> {
    const isImage = file.mimetype.startsWith('image/');
    const ext = isImage ? '.webp' : path.extname(file.originalname);
    const filename = `${randomUUID()}${ext}`;
    const filepath = path.join(this.uploadDir, filename);

    const buffer = file.buffer;

    await fs.promises.writeFile(filepath, buffer);

    const type = file.mimetype.startsWith('video')
      ? 'video'
      : file.mimetype.startsWith('audio')
        ? 'audio'
        : 'image';

    const baseUrl =
      this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
    const url = `${baseUrl}/uploads/${filename}`;

    return { url, type };
  }

  async delete(url: string): Promise<void> {
    try {
      const filename = path.basename(url);
      const filepath = path.join(this.uploadDir, filename);
      if (fs.existsSync(filepath)) {
        await fs.promises.unlink(filepath);
      }
    } catch (error) {
      console.error('Failed to delete local file:', error);
    }
  }
}
