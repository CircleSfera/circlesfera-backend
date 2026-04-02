import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStoryDto {
  @IsString()
  mediaUrl!: string;

  @IsOptional()
  @IsEnum(['image', 'video'])
  mediaType?: string = 'image';

  @IsOptional()
  isCloseFriendsOnly?: boolean;

  @IsString()
  @IsOptional()
  audioId?: string;

  // PPV Monetization
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
