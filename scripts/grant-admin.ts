import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the root .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Searching for user "user1"...');

  // Try to find by username first
  const profile = await prisma.profile.findUnique({
    where: { username: 'user1' },
    include: { user: true },
  });

  let userId: string | null = null;

  if (profile) {
    console.log(
      `Found user by username: ${profile.username} (Email: ${profile.user.email})`,
    );
    userId = profile.userId;
  } else {
    // Try to find by email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'user1@example.com' },
          { email: { contains: 'user1', mode: 'insensitive' } },
        ],
      },
    });

    if (user) {
      console.log(`Found user by email: ${user.email}`);
      userId = user.id;
    }
  }

  if (userId) {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: 'ADMIN' },
    });
    console.log(`Successfully updated user role to: ${updatedUser.role}`);
  } else {
    console.log('User "user1" not found.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
