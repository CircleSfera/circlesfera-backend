import { IsString, IsOptional } from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  caption?: string;
}
