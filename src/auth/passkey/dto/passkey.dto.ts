import { IsNotEmpty, IsObject, IsString, IsOptional } from 'class-validator';

import {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';

export class RegisterPasskeyDto {
  @IsNotEmpty()
  @IsObject()
  registrationResponse!: RegistrationResponseJSON;

  @IsOptional()
  @IsString()
  label?: string;
}

export class GetPasskeyOptionsDto {
  @IsNotEmpty()
  @IsString()
  email!: string;
}

export class AuthenticatePasskeyDto {
  @IsNotEmpty()
  @IsString()
  email!: string;

  @IsNotEmpty()
  @IsObject()
  authenticationResponse!: AuthenticationResponseJSON;
}
