import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service.js';
import { REQUIRES_PLAN_KEY } from '../decorators/requires-plan.decorator.js';

interface RequestWithUser extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlan = this.reflector.getAllAndOverride<string>(
      REQUIRES_PLAN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPlan) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user || !user.userId) {
      return false;
    }

    // Define plan hierarchy
    const planHierarchy = ['Premium', 'Elite Creator', 'Business'];
    const requiredLevel = planHierarchy.indexOf(requiredPlan);

    // Check for active subscription
    const userSubscription = await this.prisma.platformSubscription.findFirst({
      where: {
        userId: user.userId,
        status: 'active',
      },
      include: {
        plan: true,
      },
    });

    if (!userSubscription) {
      throw new ForbiddenException(
        `This feature requires an active '${requiredPlan}' subscription.`,
      );
    }

    const userLevel = planHierarchy.indexOf(userSubscription.plan.name);

    if (userLevel < requiredLevel) {
      throw new ForbiddenException(
        `Your current plan '${userSubscription.plan.name}' is not sufficient. This feature requires at least '${requiredPlan}'.`,
      );
    }

    return true;
  }
}
