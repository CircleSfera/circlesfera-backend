import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Headers,
  RawBodyRequest,
  BadRequestException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Request } from 'express';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('analytics/creator')
  async getCreatorAnalytics(@Req() req: Request & { user: { id: string } }) {
    return this.paymentsService.getCreatorAnalytics(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('connect-onboarding')
  async generateConnectLink(@Req() req: Request & { user: { id: string } }) {
    const userId = req.user.id;
    return this.paymentsService.createConnectAccount(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async createCheckoutSession(
    @Req() req: Request & { user: { id: string } },
    @Body() body: { targetType: string; targetId: string },
  ) {
    return this.paymentsService.createCheckoutSession(
      req.user.id,
      body.targetType,
      body.targetId,
    );
  }

  // Webhook endpoint (Requires raw body parsed by NestJS, disabled globally in main.ts usually and bypassed specifically for webhooks)
  @Post('webhook')
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!signature || !req.rawBody) {
      throw new BadRequestException('Missing payload or signature');
    }
    return this.paymentsService.handleWebhook(signature, req.rawBody);
  }
}
