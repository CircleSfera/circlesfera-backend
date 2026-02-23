import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  GenerateRegistrationOptionsOpts,
  VerifyRegistrationResponseOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyAuthenticationResponseOpts,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';

/**
 * Service for FIDO2/WebAuthn passkey registration and authentication.
 * Uses @simplewebauthn/server for challenge generation and verification.
 */
@Injectable()
export class PasskeyService {
  private readonly rpName = 'CircleSfera';
  private readonly rpID: string;
  private readonly origin: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.rpID = this.configService.get<string>('WEBAUTHN_RP_ID') || 'localhost';
    this.origin =
      this.configService.get<string>('WEBAUTHN_ORIGIN') ||
      'http://localhost:5173';
  }

  /**
   * Generate WebAuthn registration options (challenge) for a user.
   * Stores the challenge in the user record for later verification.
   * @param userId - The authenticated user's ID
   * @throws NotFoundException if user not found
   */
  async generateRegistrationOptions(userId: string) {
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        passkeys: true,
      },
    })) as unknown as {
      id: string;
      email: string;
      profile?: { username?: string | null; fullName?: string | null } | null;
      passkeys: {
        id: string;
        credentialID: string;
        publicKey: Buffer;
        counter: bigint | number;
        transports: AuthenticatorTransportFuture[];
      }[];
      currentChallenge?: string | null;
    } | null;

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const options: GenerateRegistrationOptionsOpts = {
      rpName: this.rpName,
      rpID: this.rpID,
      userID: Buffer.from(user.id),
      userName: user.profile?.username || user.email,
      userDisplayName: user.profile?.fullName || user.email,
      attestationType: 'none',
      excludeCredentials: user.passkeys.map((pk) => ({
        id: pk.credentialID,
        type: 'public-key' as const,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    };

    const registrationOptions = await generateRegistrationOptions(options);

    // Store challenge
    await this.prisma.user.update({
      where: { id: userId },
      data: { currentChallenge: registrationOptions.challenge },
    });

    return registrationOptions;
  }

  /**
   * Verify a WebAuthn registration response, storing the new passkey credential.
   * @param userId - The authenticated user's ID
   * @param body - The registration response from the client
   * @returns `{ verified: boolean }`
   * @throws BadRequestException if challenge missing or verification fails
   */
  async verifyRegistration(userId: string, body: any) {
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
    })) as unknown as { currentChallenge?: string | null } | null;

    if (!user || !user.currentChallenge) {
      throw new BadRequestException('Registration challenge not found');
    }

    const expectedChallenge = user.currentChallenge;

    const opts: VerifyRegistrationResponseOpts = {
      response: body as VerifyRegistrationResponseOpts['response'],
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
    };

    try {
      const verification = await verifyRegistrationResponse(opts);

      if (verification.verified && verification.registrationInfo) {
        const { credential } = verification.registrationInfo;
        const { id, publicKey, counter } = credential;

        const prisma = this.prisma as unknown as {
          passkey: {
            create: (args: {
              data: {
                userId: string;
                credentialID: string;
                publicKey: Buffer;
                counter: bigint;
                transports: AuthenticatorTransportFuture[];
              };
            }) => Promise<any>;
          };
        };

        await prisma.passkey.create({
          data: {
            userId,
            credentialID: id,
            publicKey: Buffer.from(publicKey),
            counter: BigInt(counter),
            transports:
              (
                body as {
                  response: { transports?: AuthenticatorTransportFuture[] };
                }
              ).response.transports || [],
          },
        });

        await this.prisma.user.update({
          where: { id: userId },
          data: { currentChallenge: null },
        });

        return { verified: true };
      }

      return { verified: false };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Passkey registration failed: ${message}`);
    }
  }

  /**
   * Generate WebAuthn authentication options (challenge) for login.
   * @param email - The user's email address
   * @throws NotFoundException if user not found
   */
  async generateAuthenticationOptions(email: string) {
    const user = (await this.prisma.user.findUnique({
      where: { email },
      include: {
        passkeys: true,
      },
    })) as unknown as {
      id: string;
      passkeys: {
        credentialID: string;
        transports?: AuthenticatorTransportFuture[];
      }[];
      currentChallenge?: string | null;
    } | null;

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const opts: GenerateAuthenticationOptionsOpts = {
      rpID: this.rpID,
      allowCredentials: user.passkeys.map((pk) => ({
        id: pk.credentialID,
        type: 'public-key' as const,
        transports: pk.transports || [],
      })),
      userVerification: 'preferred',
    };

    const authenticationOptions = await generateAuthenticationOptions(opts);

    // Store challenge
    await this.prisma.user.update({
      where: { id: user.id },
      data: { currentChallenge: authenticationOptions.challenge },
    });

    return authenticationOptions;
  }

  /**
   * Verify a WebAuthn authentication response for passwordless login.
   * Updates the passkey counter on success.
   * @param email - The user's email address
   * @param body - The authentication response from the client
   * @returns `{ verified: boolean, userId?: string }`
   * @throws BadRequestException if challenge missing, passkey not found, or verification fails
   */
  async verifyAuthentication(email: string, body: any) {
    const user = (await this.prisma.user.findUnique({
      where: { email },
      include: {
        passkeys: true,
      },
    })) as unknown as {
      id: string;
      passkeys: {
        credentialID: string;
        publicKey: Buffer;
        counter: bigint | number;
        transports: AuthenticatorTransportFuture[];
      }[];
      currentChallenge?: string | null;
    } | null;

    if (!user || !user.currentChallenge) {
      throw new BadRequestException('Authentication challenge not found');
    }

    const passkey = user.passkeys.find(
      (pk) => pk.credentialID === (body as { id: string }).id,
    );
    if (!passkey) {
      throw new BadRequestException('Passkey not found');
    }

    const opts: VerifyAuthenticationResponseOpts = {
      response: body as VerifyAuthenticationResponseOpts['response'],
      expectedChallenge: user.currentChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
      credential: {
        id: passkey.credentialID,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: passkey.transports,
      },
    };

    try {
      const verification = await verifyAuthenticationResponse(opts);

      if (verification.verified) {
        // Update counter
        const prisma = this.prisma as unknown as {
          passkey: {
            update: (args: {
              where: { credentialID: string };
              data: { counter: bigint };
            }) => Promise<any>;
          };
        };

        await prisma.passkey.update({
          where: {
            credentialID: passkey.credentialID,
          },
          data: {
            counter: BigInt(verification.authenticationInfo.newCounter),
          },
        });

        // Clear challenge
        await this.prisma.user.update({
          where: { id: user.id },
          data: { currentChallenge: null },
        });

        return { verified: true, userId: user.id };
      }

      return { verified: false };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(
        `Passkey authentication failed: ${message}`,
      );
    }
  }
}
