import 'dotenv/config'; // Asegurar carga de variables
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

console.log(`Connecting to DB URL: ${process.env.DATABASE_URL}`);

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface UserWithProfile {
  id: string;
  email: string;
  profile: {
    username: string;
    fullName: string | null;
  } | null;
}

interface Post {
  id: string;
  userId: string;
  caption: string | null;
}

async function main(): Promise<void> {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  console.log('🧹 Clearing existing data...');
  await prisma.comment.deleteMany();
  await prisma.like.deleteMany();
  await prisma.postMedia.deleteMany();
  await prisma.postTag.deleteMany();
  await prisma.postHashtag.deleteMany();
  await prisma.post.deleteMany();
  await prisma.story.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Database cleared');

  // Create users with profiles
  const users: UserWithProfile[] = [];
  for (let i = 1; i <= 5; i++) {
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = (await prisma.user.create({
      data: {
        email: `user${i}@example.com`,
        password: hashedPassword,
        profile: {
          create: {
            username: `user${i}`,
            fullName: `User ${i}`,
            bio: `Hello! I'm user ${i}. Welcome to my profile!`,
            avatar: `https://i.pravatar.cc/150?img=${i}`,
          },
        },
      },
      include: {
        profile: true,
      },
    })) as unknown as UserWithProfile;
    users.push(user);
    console.log(`✅ Created user: ${user.profile?.username}`);
  }

  // Create follows
  for (let i = 0; i < users.length; i++) {
    for (let j = 0; j < users.length; j++) {
      if (i !== j && Math.random() > 0.5) {
        await prisma.follow.create({
          data: {
            followerId: users[i].id,
            followingId: users[j].id,
          },
        });
      }
    }
  }
  console.log('✅ Created follow relationships');

  // Create posts
  const posts: Post[] = [];
  for (const user of users) {
    for (let i = 1; i <= 3; i++) {
      const post = (await prisma.post.create({
        data: {
          userId: user.id,
          caption: `This is post ${i} from ${user.profile?.username}! #social #instagram`,
          media: {
            create: [
              {
                url: `https://picsum.photos/800/600?random=${user.id}-${i}`,
                type: 'image',
                order: 0,
              },
            ],
          },
        },
      })) as Post;
      posts.push(post);
    }
  }
  console.log(`✅ Created ${posts.length} posts`);

  // Create likes
  for (const post of posts) {
    const numLikes = Math.floor(Math.random() * users.length);
    const shuffledUsers = [...users].sort(() => Math.random() - 0.5);
    for (let i = 0; i < numLikes; i++) {
      try {
        await prisma.like.create({
          data: {
            postId: post.id,
            userId: shuffledUsers[i].id,
          },
        });
      } catch {
        // Skip duplicate likes
      }
    }
  }
  console.log('✅ Created likes');

  // Create comments
  for (const post of posts) {
    const numComments = Math.floor(Math.random() * 5);
    for (let i = 0; i < numComments; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      await prisma.comment.create({
        data: {
          postId: post.id,
          userId: randomUser.id,
          content: `Great post! This is comment ${i + 1} from ${randomUser.profile?.username}`,
        },
      });
    }
  }
  console.log('✅ Created comments');

  // Create stories
  for (const user of users) {
    if (Math.random() > 0.5) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      await prisma.story.create({
        data: {
          userId: user.id,
          mediaUrl: `https://picsum.photos/600/1000?random=story-${user.id}`,
          mediaType: 'image',
          expiresAt,
        },
      });
    }
  }
  console.log('✅ Created stories');

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e: unknown) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
