import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

class MediaItemDto {
  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsString()
  @IsOptional()
  type!: string; // 'image' | 'video'

  @IsString()
  @IsOptional()
  filter?: string;

  @IsString()
  @IsOptional()
  altText?: string;
}

export class CreatePostDto {
  @IsString()
  @IsOptional()
  caption?: string;

  @IsOptional()
  @IsEnum(['POST', 'FRAME'])
  type?: 'POST' | 'FRAME';

  @IsString()
  @IsOptional()
  location?: string;

  @IsOptional()
  @IsBoolean()
  hideLikes?: boolean;

  @IsOptional()
  @IsBoolean()
  turnOffComments?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  @IsOptional()
  media?: MediaItemDto[];

  @IsString()
  @IsOptional()
  audioId?: string;
}
