import { Controller, Get, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Request, Response } from 'express';
import { generateCsrfToken } from './common/config/csrf.config';

/** Root controller providing the health-check and security endpoints. */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Health-check: returns a greeting string from AppService. */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** GET /csrf-token: Generates and returns a CSRF token for the frontend. */
  @Get('csrf-token')
  getCsrfToken(@Req() req: Request, @Res() res: Response): void {
    const token = generateCsrfToken(req, res);
    res.json({ csrfToken: token });
  }
}
