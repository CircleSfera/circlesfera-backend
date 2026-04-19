import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService implements OnModuleInit {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY') || '';
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-03-25.dahlia',
    });
  }

  /**
   * Validate that required Stripe keys are present on startup.
   * In production, this will crash the app if keys are missing — intentional.
   */
  onModuleInit() {
    const isProd = this.configService.get('NODE_ENV') === 'production';
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    if (isProd) {
      if (
        !secretKey ||
        secretKey.includes('CHANGE_ME') ||
        secretKey.includes('dummy')
      ) {
        throw new Error(
          'SECURITY ALERT: STRIPE_SECRET_KEY is missing or placeholder in production.',
        );
      }
      if (
        !webhookSecret ||
        webhookSecret.includes('CHANGE_ME') ||
        webhookSecret.includes('dummy')
      ) {
        throw new Error(
          'SECURITY ALERT: STRIPE_WEBHOOK_SECRET is missing or placeholder in production.',
        );
      }
    }

    if (!secretKey || secretKey.includes('dummy')) {
      this.logger.warn(
        'Stripe is running in SIMULATOR mode — no real charges will be processed.',
      );
    }
  }

  async createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }) {
    const session = await this.stripe.checkout.sessions.create({
      customer: params.customerId,
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    });

    return { url: session.url };
  }

  async createCustomer(email: string, name?: string) {
    return this.stripe.customers.create({
      email,
      name,
    });
  }

  async createPortalSession(customerId: string, returnUrl: string) {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  /**
   * Verify and construct a Stripe webhook event from a raw body + signature.
   * This is CRITICAL for security — never process unverified events.
   */
  constructEvent(payload: Buffer, sig: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }
    return this.stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  }

  /**
   * Retrieve a Stripe Subscription object by ID.
   */
  async getSubscription(subscriptionId: string) {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }
}
