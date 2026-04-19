import { IsString, IsOptional, IsEnum } from 'class-validator';
import { Visibility } from '@prisma/client';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;
}
