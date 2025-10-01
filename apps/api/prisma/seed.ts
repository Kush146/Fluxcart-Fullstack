// apps/api/prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** --------------------------
 *  Helpers / Data sources
 *  -------------------------- */
type Category =
  | "Apparel"
  | "Books"
  | "Electronics"
  | "Fitness"
  | "Footwear"
  | "Furniture"
  | "Home"
  | "Outdoors"
  | "Toys";

const CATEGORIES: Category[] = [
  "Apparel",
  "Books",
  "Electronics",
  "Fitness",
  "Footwear",
  "Furniture",
  "Home",
  "Outdoors",
  "Toys",
];

const ADJECTIVES = [
  "Classic",
  "Premium",
  "Smart",
  "Eco",
  "Compact",
  "Deluxe",
  "Lightweight",
  "Pro",
  "Everyday",
  "Ultra",
  "Vintage",
  "Modern",
];

const BASE_NAMES: Record<Category, string[]> = {
  Apparel: ["T-Shirt", "Denim Jacket", "Kurta", "Hoodie", "Saree", "Formal Shirt"],
  Books: [
    "Bestseller Novel",
    "Thriller Paperback",
    "Children’s Picture Book",
    "Self-Help Guide",
    "Cookbook",
    "Startup Playbook",
  ],
  Electronics: [
    "Bluetooth Speaker",
    "Wireless Headphones",
    "Smartwatch",
    "Power Bank 20,000 mAh",
    "Mechanical Keyboard",
    "4K Streaming Stick",
  ],
  Fitness: [
    "Yoga Mat",
    "Adjustable Dumbbell (2×10 kg)",
    "Skipping Rope",
    "Resistance Bands Set",
    "Kettlebell 12 kg",
    "Foam Roller",
  ],
  Footwear: [
    "Running Shoes",
    "Casual Sneakers",
    "Trekking Boots",
    "Loafers",
    "Training Shoes",
    "Sandals",
  ],
  Furniture: [
    "Study Table",
    "Ergonomic Chair",
    "Bookshelf",
    "Bedside Table",
    "TV Unit",
    "Sofa (2-Seater)",
  ],
  Home: [
    "Cookware Set (Tri-Ply, 3-pc)",
    "Air Fryer (4L)",
    "Vacuum Cleaner",
    "Dinner Set (18-pc)",
    "Electric Kettle",
    "Table Lamp",
  ],
  Outdoors: [
    "Camping Tent (3-Person)",
    "Hiking Backpack 40L",
    "Sleeping Bag",
    "Portable Stove",
    "Water Bottle (1L)",
    "Headlamp",
  ],
  Toys: [
    "R/C Car (Rechargeable)",
    "Building Blocks Set (120 pcs)",
    "Puzzle 1000 pcs",
    "Plush Toy",
    "Science Kit",
    "Art & Craft Box",
  ],
};

const PRICE_BY_CATEGORY: Record<Category, [number, number]> = {
  Apparel: [499, 1999],
  Books: [199, 799],
  Electronics: [999, 4999],
  Fitness: [299, 3499],
  Footwear: [899, 3999],
  Furniture: [1199, 14999],
  Home: [399, 4999],
  Outdoors: [499, 7999],
  Toys: [299, 2499],
};

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(arr: T[]) => arr[rand(arr.length)];
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const titleize = (base: string) => `${pick(ADJECTIVES)} ${base}`;
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
const descr = (cat: string, base: string) =>
  `High-quality ${base.toLowerCase()} in ${cat}. Carefully curated for FluxCart — available to buy, rent, or swap.`;
const dailyFrom = (priceCents: number) => clamp(Math.round(priceCents * 0.03), 2500, 99900); // paise

/** ---------- Local/CDN image mapping (no flaky externals) ---------- */
/**
 * If you keep images inside apps/web/public/catalog/**,
 * leave ASSET_BASE_URL empty and the URLs will be like:
 *   /catalog/Toys/t1.jpg
 *
 * If you upload the same structure to a bucket/CDN, set:
 *   ASSET_BASE_URL=https://cdn.example.com/catalog
 */
const ASSET_BASE = process.env.ASSET_BASE_URL?.replace(/\/+$/, "") || "";

const IMAGE_FILES: Record<Category, string[]> = {
  Apparel:     ["a1.jpg","a2.jpg","a3.jpg","a4.jpg","a5.jpg","a6.jpg"],
  Books:       ["b1.jpg","b2.jpg","b3.jpg","b4.jpg","b5.jpg","b6.jpg"],
  Electronics: ["e1.jpg","e2.jpg","e3.jpg","e4.jpg","e5.jpg","e6.jpg"],
  Fitness:     ["f1.jpg","f2.jpg","f3.jpg","f4.jpg","f5.jpg","f6.jpg"],
  Footwear:    ["ft1.jpg","ft2.jpg","ft3.jpg","ft4.jpg","ft5.jpg","ft6.jpg"],
  Furniture:   ["fu1.jpg","fu2.jpg","fu3.jpg","fu4.jpg","fu5.jpg","fu6.jpg"],
  Home:        ["h1.jpg","h2.jpg","h3.jpg","h4.jpg","h5.jpg","h6.jpg"],
  Outdoors:    ["o1.jpg","o2.jpg","o3.jpg","o4.jpg","o5.jpg","o6.jpg"],
  Toys:        ["t1.jpg","t2.jpg","t3.jpg","t4.jpg","t5.jpg","t6.jpg"],
};

function imgUrl(category: Category, filename: string) {
  const local = `/catalog/${category}/${filename}`; // served by Next public/
  return ASSET_BASE ? `${ASSET_BASE}/${category}/${filename}` : local;
}

function imgsFor(slug: string, category: Category): string[] {
  const files = IMAGE_FILES[category];
  // deterministic rotation so items in same category don't all show the same photo
  const seed = Math.abs([...slug].reduce((a, c) => a + c.charCodeAt(0), 0));
  const i = seed % files.length;
  return [
    imgUrl(category, files[i % files.length]),
    imgUrl(category, files[(i + 1) % files.length]),
    imgUrl(category, files[(i + 2) % files.length]),
  ];
}

/** --------------------------
 *  Main
 *  -------------------------- */
async function main() {
  // 1) Ensure a dev user exists
  const user = await prisma.user.upsert({
    where: { email: "dev@fluxcart.local" },
    update: {},
    create: { email: "dev@fluxcart.local", name: "Dev User" },
  });

  // 2) Generate ~108 products (12 per category × 9 categories)
  const PRODUCTS_PER_CATEGORY = 12;

  for (const category of CATEGORIES) {
    const baseNames = BASE_NAMES[category];

    for (let i = 0; i < PRODUCTS_PER_CATEGORY; i++) {
      const base = baseNames[i % baseNames.length];
      const title = titleize(base);
      const slug = `${slugify(title)}-${category.toLowerCase()}-${i + 1}`;

      const [min, max] = PRICE_BY_CATEGORY[category];
      const price = Math.round(min + Math.random() * (max - min));
      const priceCents = price * 100;

      const product = await prisma.product.upsert({
        where: { slug },
        update: {
          title,
          description: descr(category, base),
          priceCents,
          currency: "INR",
          rating: Number((3.9 + Math.random() * 1.1).toFixed(1)),
          images: imgsFor(slug, category),
          stock: 5 + rand(25),
          category,
        },
        create: {
          title,
          slug,
          description: descr(category, base),
          priceCents,
          currency: "INR",
          rating: Number((3.9 + Math.random() * 1.1).toFixed(1)),
          images: imgsFor(slug, category),
          stock: 5 + rand(25),
          category,
        },
      });

      // 3) ~60%: RentalPolicy
      const rentable = Math.random() < 0.6;
      if (rentable) {
        await prisma.rentalPolicy.upsert({
          where: { productId: product.id },
          update: {
            minDays: 1,
            maxDays: 14 + rand(16),
            dailyPrice: dailyFrom(priceCents),
            depositCents: Math.round(priceCents * 0.2),
          },
          create: {
            productId: product.id,
            minDays: 1,
            maxDays: 14 + rand(16),
            dailyPrice: dailyFrom(priceCents),
            depositCents: Math.round(priceCents * 0.2),
          },
        });
      } else {
        await prisma.rentalPolicy.deleteMany({ where: { productId: product.id } });
      }
    }
  }

  const total = await prisma.product.count();
  console.log(`✅ Seeded ${total} products. Dev user id: ${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
