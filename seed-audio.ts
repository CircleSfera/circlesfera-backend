import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const tracks = [
    {
      title: 'Midnight City',
      artist: 'M83',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      thumbnailUrl:
        'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200&h=200&fit=crop',
      duration: 243,
    },
    {
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      thumbnailUrl:
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop',
      duration: 200,
    },
    {
      title: 'Stay',
      artist: 'The Kid LAROI & Justin Bieber',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      thumbnailUrl:
        'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=200&h=200&fit=crop',
      duration: 141,
    },
  ];

  console.log('Seeding audio tracks...');
  for (const track of tracks) {
    const id = 'dummy-' + track.title.toLowerCase().replace(/\s/g, '-');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await (prisma as any).audio.upsert({
      where: { id },
      update: {},
      create: {
        id,
        ...track,
      },
    });
  }
  console.log('Seeding complete!');
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
