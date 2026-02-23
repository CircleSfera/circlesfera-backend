import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * NestJS-managed Prisma client. Connects on module init and disconnects on destroy.
 * Uses the pg adapter with a connection pool backed by DATABASE_URL.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  /** Connect to the database when the NestJS module initializes. */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** Disconnect from the database when the NestJS module is destroyed. */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
