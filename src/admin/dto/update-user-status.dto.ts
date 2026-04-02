import { IsEnum, IsOptional, IsBoolean, IsString } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserStatusDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  verificationLevel?: string;

  @IsOptional()
  @IsString()
  accountType?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
