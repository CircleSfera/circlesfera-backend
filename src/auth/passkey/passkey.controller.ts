import {
  Controller,
  Post,
  Body,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { PasskeyService } from './passkey.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { CurrentUserData } from '../decorators/current-user.decorator';
import { RegisterPasskeyDto, AuthenticatePasskeyDto } from './dto/passkey.dto';
import { AuthService } from '../auth.service';

/** REST controller for FIDO2/WebAuthn passkey registration and authentication. */
@Controller('api/v1/auth/passkey')
export class PasskeyController {
  constructor(
    private readonly passkeyService: PasskeyService,
    private readonly authService: AuthService,
  ) {}

  /** Generate WebAuthn registration options (requires auth). */
  @UseGuards(JwtAuthGuard)
  @Post('register-options')
  async generateRegistrationOptions(@CurrentUser() user: CurrentUserData) {
    return this.passkeyService.generateRegistrationOptions(user.userId);
  }

  /** Verify WebAuthn registration and store the passkey (requires auth). */
  @UseGuards(JwtAuthGuard)
  @Post('register-verify')
  async verifyRegistration(
    @CurrentUser() user: CurrentUserData,
    @Body() body: RegisterPasskeyDto,
  ) {
    return this.passkeyService.verifyRegistration(
      user.userId,
      body.registrationResponse,
    );
  }

  /** Generate WebAuthn authentication options for passwordless login. */
  @Post('login-options')
  async generateAuthenticationOptions(@Body('email') email: string) {
    return this.passkeyService.generateAuthenticationOptions(email);
  }

  /** Verify WebAuthn authentication response and issue JWT tokens. */
  @Post('login-verify')
  async verifyAuthentication(
    @Body('email') email: string,
    @Body() body: AuthenticatePasskeyDto,
  ) {
    const result = await this.passkeyService.verifyAuthentication(
      email,
      body.authenticationResponse,
    );

    if (result.verified && result.userId) {
      // result.userId is a string at this point
      return this.authService.loginById(result.userId);
    }

    throw new UnauthorizedException('Passkey authentication failed');
  }
}
