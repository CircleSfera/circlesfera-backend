import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';

/**
 * Service for sending transactional emails (verification, password reset, welcome).
 * Uses Brevo (formerly Sendinblue) API v3 via the official Node.js SDK (v5+).
 * Silently skips failures in non-production environments.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly brevo?: BrevoClient;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    if (apiKey) {
      this.brevo = new BrevoClient({ apiKey });
    } else {
      this.logger.warn(
        'BREVO_API_KEY is not configured. Email sending will be skipped.',
      );
    }
  }

  /**
   * Send a welcome email to a user who just joined the whitelist.
   * @param email - The recipient's email address
   * @param name - The recipient's name
   */
  async sendWelcomeEmail(email: string, name: string) {
    await this.sendMail({
      to: email,
      subject: '¡Bienvenido a la Whitelist de CircleSfera!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              background-color: #000000; 
              color: #ffffff; 
              margin: 0; 
              padding: 0; 
            }
            .wrapper {
              background-color: #000000;
              padding: 40px 20px;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 48px; 
              background-color: #0f0f14;
              border: 1px solid rgba(255, 255, 255, 0.1); 
              border-radius: 32px; 
              position: relative;
              overflow: hidden;
            }
            .accent-line {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 4px;
              background: linear-gradient(to right, #833ab4, #fd1d1d, #fcb045);
            }
            .header { text-align: center; margin-bottom: 40px; }
            .logo { 
              font-size: 36px; 
              font-weight: 900; 
              color: #ffffff;
              letter-spacing: -2px;
              background: linear-gradient(to bottom, #ffffff, rgba(255, 255, 255, 0.4));
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            .content { line-height: 1.6; font-size: 16px; color: #94a3b8; }
            h1 { color: #ffffff; font-size: 28px; margin-bottom: 20px; font-weight: 900; text-align: center; letter-spacing: -1px; }
            .highlight { color: #833ab4; font-weight: 800; }
            .button { 
              display: block; 
              width: fit-content; 
              margin: 40px auto; 
              padding: 16px 32px; 
              background: #ffffff; 
              color: #000000 !important; 
              text-decoration: none; 
              border-radius: 16px; 
              font-weight: 900; 
              text-align: center; 
              text-transform: uppercase;
              font-size: 14px;
              letter-spacing: 1px;
            }
            .footer { 
              margin-top: 48px; 
              text-align: center; 
              font-size: 12px; 
              color: #475569; 
              border-top: 1px solid rgba(255, 255, 255, 0.05); 
              padding-top: 32px; 
            }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="container">
              <div class="accent-line"></div>
              <div class="header">
                <div class="logo">CircleSfera</div>
              </div>
              <div class="content">
                <h1>¡Hola, ${name}!</h1>
                <p>Gracias por unirte a nuestra <span class="highlight">Whitelist</span>. Estamos muy emocionados de tenerte con nosotros en las primeras etapas de este viaje.</p>
                <p>CircleSfera es más que una plataforma; es el espacio donde tus círculos toman vida. Como miembro de la whitelist, serás de los primeros en recibir acceso exclusivo a nuestras funciones premium.</p>
                <p>Te mantendremos informado sobre nuestras próximas novedades y la fecha oficial de lanzamiento.</p>
                <a href="https://circlesfera.com" class="button">Explorar CircleSfera</a>
                <p>Si tienes alguna pregunta, simplemente responde a este correo. ¡Estamos aquí para ayudarte!</p>
              </div>
              <div class="footer">
                <p>&copy; 2026 CircleSfera. Todos los derechos reservados.</p>
                <p>Has recibido este correo porque te has registrado en nuestra lista de espera.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });
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
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Inter', sans-serif; background-color: #000000; color: #ffffff; margin: 0; padding: 0; }
            .wrapper { background-color: #000000; padding: 40px 20px; }
            .container { max-width: 600px; margin: 0 auto; padding: 48px; background-color: #0f0f14; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 32px; position: relative; overflow: hidden; }
            .accent-line { position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(to right, #833ab4, #fd1d1d, #fcb045); }
            .header { text-align: center; margin-bottom: 32px; }
            .logo { font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: -2px; }
            .content { line-height: 1.6; font-size: 16px; color: #94a3b8; text-align: center; }
            h1 { color: #ffffff; font-size: 24px; margin-bottom: 16px; font-weight: 900; }
            .button { display: inline-block; padding: 16px 32px; background: #ffffff; color: #000000 !important; text-decoration: none; border-radius: 16px; font-weight: 900; text-transform: uppercase; font-size: 14px; letter-spacing: 1px; margin-top: 24px; }
            .footer { margin-top: 48px; text-align: center; font-size: 11px; color: #475569; }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="container">
              <div class="accent-line"></div>
              <div class="header"><div class="logo">CircleSfera</div></div>
              <div class="content">
                <h1>Verifica tu cuenta</h1>
                <p>Para completar tu registro y unirte al círculo, haz clic en el siguiente enlace:</p>
                <a href="${url}" class="button">Verificar Email</a>
              </div>
              <div class="footer">
                <p>Si no has solicitado esta cuenta, puedes ignorar este correo.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
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
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Inter', sans-serif; background-color: #000000; color: #ffffff; margin: 0; padding: 0; }
            .wrapper { background-color: #000000; padding: 40px 20px; }
            .container { max-width: 600px; margin: 0 auto; padding: 48px; background-color: #0f0f14; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 32px; position: relative; overflow: hidden; }
            .accent-line { position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(to right, #833ab4, #fd1d1d, #fcb045); }
            .header { text-align: center; margin-bottom: 32px; }
            .logo { font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: -2px; }
            .content { line-height: 1.6; font-size: 16px; color: #94a3b8; text-align: center; }
            h1 { color: #ffffff; font-size: 24px; margin-bottom: 16px; font-weight: 900; }
            .button { display: inline-block; padding: 16px 32px; background: #ffffff; color: #000000 !important; text-decoration: none; border-radius: 16px; font-weight: 900; text-transform: uppercase; font-size: 14px; letter-spacing: 1px; margin-top: 24px; }
            .footer { margin-top: 48px; text-align: center; font-size: 11px; color: #475569; }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="container">
              <div class="accent-line"></div>
              <div class="header"><div class="logo">CircleSfera</div></div>
              <div class="content">
                <h1>Recuperación de Contraseña</h1>
                <p>Has solicitado restablecer tu contraseña. Haz clic en el botón de abajo para continuar:</p>
                <a href="${url}" class="button">Restablecer Contraseña</a>
              </div>
              <div class="footer">
                <p>Si no has solicitado este cambio, ignora este mensaje.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }

  /**
   * Low-level method to send an email via Brevo API.
   * @param options - Email options
   */
  private async sendMail(options: {
    to: string;
    subject: string;
    html: string;
  }) {
    if (!this.brevo) {
      this.logger.warn(
        `Skipping email send to ${options.to}: BREVO_API_KEY not set.`,
      );
      return;
    }

    const fromEmail =
      this.configService.get<string>('EMAIL_FROM') || 'noreply@circlesfera.com';
    const fromName =
      this.configService.get<string>('EMAIL_FROM_NAME') || 'CircleSfera';

    try {
      await this.brevo.transactionalEmails.sendTransacEmail({
        subject: options.subject,
        htmlContent: options.html,
        sender: { email: fromEmail, name: fromName },
        to: [{ email: options.to }],
      });
      this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
    } catch (error: unknown) {
      this.logger.error('Failed to send email via Brevo', error);

      if (this.configService.get<string>('NODE_ENV') === 'production') {
        throw error;
      }
    }
  }
}
