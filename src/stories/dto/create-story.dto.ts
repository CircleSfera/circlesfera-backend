import { IsString, IsEnum, IsOptional } from 'class-validator';

export class CreateStoryDto {
  @IsString()
  mediaUrl!: string;

  @IsString()
  @IsOptional()
  standardUrl?: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsOptional()
  @IsEnum(['image', 'video'])
  mediaType?: string = 'image';

  @IsOptional()
  isCloseFriendsOnly?: boolean;

  @IsString()
  @IsOptional()
  audioId?: string;
}
