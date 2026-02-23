import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { generateCsrfToken } from '../../common/config/csrf.config';

@Controller('csrf-token')
export class CsrfController {
  @Get()
  getCsrfToken(@Req() req: Request, @Res() res: Response) {
    const token = generateCsrfToken(req, res);
    return res.json({ csrfToken: token });
  }
}
