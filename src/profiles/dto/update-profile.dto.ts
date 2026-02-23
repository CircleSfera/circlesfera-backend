import {
  IsString,
  IsOptional,
  IsUrl,
  IsBoolean,
  Matches,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'Username can only contain letters, numbers, dots and underscores',
  })
  username?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsUrl()
  @ValidateIf((o: UpdateProfileDto) => o.website !== null)
  website?: string | null;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
