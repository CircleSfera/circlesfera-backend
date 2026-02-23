import { IsString, MinLength } from 'class-validator';
import { LoginDto as ILoginDto } from '@circlesfera/shared';

export class LoginDto implements ILoginDto {
  @IsString()
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
