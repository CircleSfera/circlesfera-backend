import { Injectable, Inject } from '@nestjs/common';
import {
  StorageProvider,
  STORAGE_PROVIDER,
} from './interfaces/storage-provider.interface';
import { MediaProcessorService } from './media-processor.service';
import { UploadedFile } from './interfaces/uploaded-file.interface';

/**
 * Service for file upload and deletion. Delegates to a pluggable StorageProvider.
 */
@Injectable()
export class UploadsService {
  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
    private readonly mediaProcessor: MediaProcessorService,
  ) {}

  /**
   * Upload a file to the configured storage provider.
   * Processes images (resizing/optimization) before upload.
   * @param file - The uploaded file data
   * @returns The public URL and MIME type of the stored file
   */
  async uploadFile(file: UploadedFile): Promise<{ url: string; type: string }> {
    const processed = await this.mediaProcessor.process(file);
    return this.storageProvider.upload({
      ...file,
      buffer: processed.buffer,
      mimetype: processed.mimetype,
    });
  }

  /**
   * Delete a file from the storage provider by its URL.
   * @param url - The file URL to delete
   */
  async deleteFile(url: string): Promise<void> {
    return this.storageProvider.delete(url);
  }
}
