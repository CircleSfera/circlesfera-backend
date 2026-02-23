import { IsOptional, IsEnum } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PostType } from '@prisma/client';

export class FindPostsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;
}
