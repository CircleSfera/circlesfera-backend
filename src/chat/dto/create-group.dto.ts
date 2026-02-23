import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
} from 'class-validator';

export class CreateGroupDto {
  @IsArray()
  @IsNotEmpty()
  participantIds!: string[];

  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isGroup?: boolean = true;
}
