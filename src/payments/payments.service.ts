import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = new Stripe(secretKey || 'sk_test_dummy', {
      apiVersion: '2026-03-25.dahlia',
    });
  }

  /**
   * Generates a Stripe Connect onboarding link for authors/creators.
   */
  async createConnectAccount(userId: string) {
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
    })) as Record<string, unknown> | null;
    if (!user) throw new NotFoundException('User not found');

    let accountId = user['stripeAccountId'] as string | null;

    // Create a new connected account if none exists
    if (!accountId) {
      const account = await this.stripe.accounts.create({
        type: 'express',
        email: user['email'] as string,
        capabilities: {
          transfers: { requested: true },
        },
      });
      accountId = account.id;
      const dataUpdate: Record<string, unknown> = {
        stripeAccountId: accountId,
      };
      await (
        this.prisma as unknown as {
          user: { update: (args: Record<string, unknown>) => Promise<unknown> };
        }
      ).user.update({
        where: { id: userId },
        data: dataUpdate,
      });
    }

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    // Generate account link
    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${frontendUrl}/monetization?refresh=true`,
      return_url: `${frontendUrl}/monetization?success=true`,
      type: 'account_onboarding',
    });

    return { url: accountLink.url };
  }

  /**
   * Generates a checkout session to purchase a piece of PPV content.
   */
  async createCheckoutSession(
    buyerId: string,
    targetType: string,
    targetId: string,
  ) {
    // 1. Fetch content price and author
    let priceOptions: {
      price: number;
      currency: string;
      title: string;
      sellerId: string;
    };

    if (targetType === 'post' || targetType === 'frame') {
      const post = await this.prisma.post.findUnique({
        where: { id: targetId },
      });
      if (!post || !post.isPremium || !post.price) {
        throw new BadRequestException(
          'Content is not available for PPV purchase',
        );
      }
      priceOptions = {
        price: post.price,
        currency: post.currency,
        title: 'Premium Post Unlocking',
        sellerId: post.userId,
      };
    } else if (targetType === 'story') {
      const story = await this.prisma.story.findUnique({
        where: { id: targetId },
      });
      if (!story || !story.isPremium || !story.price) {
        throw new BadRequestException(
          'Story is not available for PPV purchase',
        );
      }
      priceOptions = {
        price: story.price,
        currency: story.currency,
        title: 'Premium Story Unlocking',
        sellerId: story.userId,
      };
    } else {
      throw new BadRequestException('Unsupported target type');
    }

    // 2. Fetch the seller's Stripe Connect ID
    const seller = (await this.prisma.user.findUnique({
      where: { id: priceOptions.sellerId },
    })) as Record<string, unknown> | null;
    if (
      !seller ||
      !seller['stripeAccountId'] ||
      !seller['isMonetizationEnabled']
    ) {
      throw new BadRequestException(
        'The author is not eligible to receive payments',
      );
    }

    // 3. Create a pending local Purchase record
    const purchaseQuery = (
      this.prisma as unknown as {
        purchase: {
          create: (args: Record<string, unknown>) => Promise<{ id: string }>;
          update: (args: Record<string, unknown>) => Promise<void>;
        };
      }
    ).purchase;

    const purchase = await purchaseQuery.create({
      data: {
        buyerId,
        sellerId: priceOptions.sellerId,
        targetType,
        targetId,
        amount: priceOptions.price,
        currency: priceOptions.currency,
        status: 'PENDING',
      },
    });

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    // 4. Create Stripe Checkout Session
    // We compute an 80% split to the author, 20% to CircleSfera
    const applicationFeeCents = Math.round(priceOptions.price * 100 * 0.2);

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: priceOptions.currency.toLowerCase(),
            product_data: { name: priceOptions.title },
            unit_amount: Math.round(priceOptions.price * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      payment_intent_data: {
        application_fee_amount: applicationFeeCents,
        transfer_data: {
          destination: seller['stripeAccountId'] as string,
        },
      },
      success_url: `${frontendUrl}/content/${targetId}?purchase=success`,
      cancel_url: `${frontendUrl}/content/${targetId}?purchase=cancelled`,
      client_reference_id: purchase.id, // We'll read this in the webhook
    });

    // 5. Update purchase with session ID
    await purchaseQuery.update({
      where: { id: purchase.id },
      data: { stripeSessionId: session.id },
    });

    return { sessionUrl: session.url };
  }

  /**
   * Process incoming Stripe webhooks
   */
  async handleWebhook(signature: string, payload: Buffer) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret)
      throw new BadRequestException('Webhook secret not configured');

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (err: unknown) {
      throw new BadRequestException(`Webhook Error: ${(err as Error).message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      if (session.client_reference_id) {
        const upd = (
          this.prisma as unknown as {
            purchase: {
              update: (args: Record<string, unknown>) => Promise<void>;
            };
          }
        ).purchase;
        await upd.update({
          where: { id: session.client_reference_id },
          data: { status: 'COMPLETED' },
        });
      }
    }

    return { received: true };
  }

  /**
   * Returns PPV analytics for a specific creator.
   * Calculates net earnings (80% of total sales).
   */
  async getCreatorAnalytics(sellerId: string) {
    const purchases = await this.prisma.purchase.findMany({
      where: {
        sellerId,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: {
          select: {
            id: true,
            email: true,
            profile: {
              select: { username: true, fullName: true, avatar: true },
            },
          },
        },
      },
    });

    let totalGross = 0;
    let monthGross = 0;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    for (const p of purchases) {
      totalGross += p.amount;
      const pDate = new Date(p.createdAt);
      if (
        pDate.getMonth() === currentMonth &&
        pDate.getFullYear() === currentYear
      ) {
        monthGross += p.amount;
      }
    }

    // Net earnings is 80%
    const totalEarnings = totalGross * 0.8;
    const earningsThisMonth = monthGross * 0.8;

    // Last 10 sales
    const recentSales = purchases.slice(0, 10);

    return {
      totalEarnings,
      earningsThisMonth,
      recentSales,
      totalSalesCount: purchases.length,
    };
  }
}
