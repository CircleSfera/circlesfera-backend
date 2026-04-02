import { IsOptional, IsEmail, IsString, IsEnum } from 'class-validator';
import { WhitelistStatus } from '@prisma/client';

export class UpdateWhitelistEntryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(WhitelistStatus)
  status?: WhitelistStatus;
}
