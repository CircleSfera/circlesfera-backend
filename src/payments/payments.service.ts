import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StripeService } from '../common/stripe/stripe.service.js';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  async createCheckout(userId: string, planId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { platformSubscriptions: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const plan = await this.prisma.platformPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) throw new NotFoundException('Plan not found');

    // Ensure customer exists in Stripe
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripeService.createCustomer(user.email);
      customerId = customer.id;
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    return this.stripeService.createCheckoutSession({
      customerId,
      priceId: plan.stripePriceId,
      successUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accounts/edit?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accounts/edit?success=false`,
      metadata: {
        userId,
        planId,
      },
    });
  }

  async getPortalUrl(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.stripeCustomerId) {
      throw new NotFoundException('Stripe customer not found for this user');
    }

    return this.stripeService.createPortalSession(
      user.stripeCustomerId,
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accounts/edit`,
    );
  }

  /**
   * Proxies signature verification to StripeService.
   */
  constructEvent(payload: Buffer, sig: string) {
    return this.stripeService.constructEvent(payload, sig);
  }

  /**
   * Main processor for incoming Stripe webhook events.
   * Handles subscription lifecycle events.
   */
  async processWebhookEvent(event: Stripe.Event) {
    const { type, data } = event;

    console.log(`Processing Stripe webhook event: ${type}`);

    // Log the event for idempotency/audit (using the model in schema)
    await this.prisma.webhookEvent
      .create({
        data: {
          provider: 'stripe',
          externalId: event.id,
          payload: event as unknown as object,
          status: 'PENDING',
        },
      })
      .catch((err: Error) =>
        console.warn(
          'Could not log webhook event (likely duplicate):',
          err.message,
        ),
      );

    switch (type) {
      case 'checkout.session.completed': {
        const session = data.object;
        const metadata = session.metadata;
        const userId = metadata?.userId;
        const planId = metadata?.planId;
        const stripeSubscriptionId = session.subscription as string;

        if (!userId || !planId || !stripeSubscriptionId) {
          console.warn(
            'Checkout session completed but missing metadata or subscription ID',
          );
          return;
        }

        const subscriptionRaw =
          await this.stripeService.getSubscription(stripeSubscriptionId);
        // Cast via unknown to a specific shape to satisfy the linter
        const stripeSubscription = subscriptionRaw as unknown as {
          status: string;
          current_period_start: number;
          current_period_end: number;
          cancel_at_period_end: boolean;
        };

        await this.prisma.platformSubscription.upsert({
          where: { userId_planId: { userId, planId } },
          update: {
            status: stripeSubscription.status,
            stripeSubscriptionId: stripeSubscriptionId,
            currentPeriodStart: new Date(
              stripeSubscription.current_period_start * 1000,
            ),
            currentPeriodEnd: new Date(
              stripeSubscription.current_period_end * 1000,
            ),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          },
          create: {
            userId,
            planId,
            status: stripeSubscription.status,
            stripeSubscriptionId: stripeSubscriptionId,
            currentPeriodStart: new Date(
              stripeSubscription.current_period_start * 1000,
            ),
            currentPeriodEnd: new Date(
              stripeSubscription.current_period_end * 1000,
            ),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          },
        });

        // Update event status
        await this.prisma.webhookEvent.update({
          where: { externalId: event.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });

        console.log(
          `Successfully processed checkout for user ${userId}, plan ${planId}`,
        );
        break;
      }

      case 'customer.subscription.deleted':
      case 'customer.subscription.updated': {
        // Cast via unknown to a specific shape to satisfy the linter
        const subscription = data.object as unknown as {
          id: string;
          status: string;
          current_period_end: number;
          cancel_at_period_end: boolean;
        };

        await this.prisma.platformSubscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          },
        });

        await this.prisma.webhookEvent.update({
          where: { externalId: event.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
        break;
      }

      default:
        console.log(`Unhandled event type: ${type}`);
    }
  }
}
