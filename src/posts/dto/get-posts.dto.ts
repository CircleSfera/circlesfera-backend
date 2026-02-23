import { IsOptional, IsString, IsIn } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** DTO for retrieving posts with pagination and sorting. */
export class GetPostsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @IsIn(['latest', 'trending'])
  sort?: 'latest' | 'trending';
}
