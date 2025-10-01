import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, images: true, slug: true },
  });

  let changed = 0;
  for (const p of products) {
    const imgs = Array.isArray(p.images) ? p.images : [];
    const filtered = imgs.filter(u => typeof u === 'string' && !u.includes('loremflickr.com'));
    if (filtered.length !== imgs.length) {
      await prisma.product.update({
        where: { id: p.id },
        data: { images: filtered }, // if this becomes [], your component’s fallback kicks in
      });
      changed++;
    }
  }
  console.log(`Cleaned ${changed} products (removed loremflickr URLs).`);
}

main().finally(() => prisma.$disconnect());
