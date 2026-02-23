import { IsNotEmpty, IsObject, IsString, IsOptional } from 'class-validator';

export class RegisterPasskeyDto {
  @IsNotEmpty()
  @IsObject()
  registrationResponse: any;

  @IsOptional()
  @IsString()
  label?: string;
}

export class AuthenticatePasskeyDto {
  @IsNotEmpty()
  @IsObject()
  authenticationResponse: any;
}
