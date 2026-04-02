import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { RegisterDto as IRegisterDto } from '@circlesfera/shared';

export class RegisterDto implements IRegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(3)
  username!: string;

  @IsString()
  @IsOptional()
  fullName?: string;
}
