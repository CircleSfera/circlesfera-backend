import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';

/**
 * Service for sending transactional emails (verification, password reset).
 * Uses SendGrid API with configuration from environment variables.
 * Silently skips failures in non-production environments.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
    } else {
      this.logger.warn(
        'SENDGRID_API_KEY is not configured. Email sending will be skipped.',
      );
    }
  }

  /**
   * Send an email verification link to a newly registered user.
   * @param email - The recipient's email address
   * @param token - The email verification token
   */
  async sendVerificationEmail(email: string, token: string) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:8080';

    const url = `${frontendUrl}/verify-email?token=${token}`;

    await this.sendMail({
      to: email,
      subject: 'Verifica tu cuenta en CircleSfera',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #833AB4;">Bienvenido a CircleSfera</h2>
          <p>Para completar tu registro, haz clic en el siguiente enlace:</p>
          <a href="${url}" style="display: inline-block; padding: 10px 20px; background-color: #833AB4; color: white; text-decoration: none; border-radius: 5px;">Verificar Email</a>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">Si no has creado esta cuenta, puedes ignorar este correo.</p>
        </div>
      `,
    });
  }

  /**
   * Send a password-reset link to the user.
   * @param email - The recipient's email address
   * @param token - The password-reset token (expires in 1 hour)
   */
  async sendPasswordResetEmail(email: string, token: string) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:8080';

    const url = `${frontendUrl}/reset-password?token=${token}`;

    await this.sendMail({
      to: email,
      subject: 'Recupera tu contraseña en CircleSfera',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #FD1D1D;">Recuperación de Contraseña</h2>
          <p>Has solicitado restablecer tu contraseña. Haz clic en el botón de abajo para continuar:</p>
          <a href="${url}" style="display: inline-block; padding: 10px 20px; background-color: #FD1D1D; color: white; text-decoration: none; border-radius: 5px;">Restablecer Contraseña</a>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">Este enlace expirará en 1 hora. Si no lo has solicitado tú, ignora este mensaje.</p>
        </div>
      `,
    });
  }

  /**
   * Low-level method to send an email via SendGrid API.
   * @param options - SendGrid MailData options
   */
  private async sendMail(options: {
    to: string;
    subject: string;
    html: string;
  }) {
    const fromEmail =
      this.configService.get<string>('SMTP_FROM') || 'noreply@circlesfera.com';
    const fromName =
      this.configService.get<string>('SMTP_FROM_NAME') || 'CircleSfera';

    const msg = {
      from: {
        email: fromEmail,
        name: fromName,
      },
      ...options,
    };

    try {
      if (!this.configService.get<string>('SENDGRID_API_KEY')) {
        this.logger.warn('Skipping email send: SENDGRID_API_KEY not set.');
        return;
      }
      await sgMail.send(msg);
      this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
    } catch (error: any) {
      this.logger.error('Failed to send email via SendGrid', error);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error && error.response && error.response.body) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        this.logger.error(JSON.stringify(error.response.body));
      }

      if (this.configService.get<string>('NODE_ENV') === 'production') {
        throw error;
      }
    }
  }
}
