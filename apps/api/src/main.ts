import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { z } from "zod";
import { PrismaClient, Prisma } from "@prisma/client";
import dotenv from "dotenv";
import Stripe from "stripe";
import { MeiliSearch } from "meilisearch";
import fastifyRawBody from "fastify-raw-body";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";

dotenv.config();

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

await app.register(cors, { origin: true, credentials: true });
await app.register(websocket);

// raw body for Stripe webhook signature verification
await app.register(fastifyRawBody, {
  field: "rawBody",
  global: false,
  encoding: "utf8",
  runFirst: true,
});

const PORT = Number(process.env.PORT ?? 4000);
const WEB_URL = process.env.WEB_URL || "http://localhost:3000";
const stripeSecret = process.env.STRIPE_SECRET || "";
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

// Optional Meilisearch
const meili = process.env.MEILI_URL
  ? new MeiliSearch({ host: process.env.MEILI_URL!, apiKey: process.env.MEILI_KEY })
  : null;

/* ---------------- Email transport (SMTP) ---------------- */
function makeTransport() {
  const host = process.env.EMAIL_SERVER!;
  const port = Number(process.env.EMAIL_PORT || 587);
  const user = process.env.EMAIL_USER!;
  const pass = process.env.EMAIL_PASSWORD!;
  if (!host || !user || !pass) {
    app.log.warn("Email not fully configured — order receipts will be skipped.");
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}
const mailer = makeTransport();
const EMAIL_FROM = process.env.EMAIL_FROM || "FluxCart <no-reply@example.com>";
const EMAIL_BCC = process.env.EMAIL_BCC || ""; // optional BCC

const inrFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

// Small sanitizer for HTML
function sanitize(text: string) {
  return String(text).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));
}

function renderOrderEmailHTML(
  order: {
    id: string;
    totalCents: number;
    discountCents: number;
    items: { qty: number; priceCents: number; product: { title: string } }[];
  },
  userName?: string,
  webUrl = WEB_URL
) {
  const lines = order.items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 12px;">${sanitize(it.product.title)}</td>
        <td style="padding:8px 12px;text-align:center;">${it.qty}</td>
        <td style="padding:8px 12px;text-align:right;">${inrFmt.format(it.priceCents / 100)}</td>
      </tr>`
    )
    .join("");

  const subtotal = order.items.reduce((s, it) => s + it.qty * it.priceCents, 0);
  const orderUrl = `${webUrl.replace(/\/$/, "")}/orders/${order.id}`;

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:auto;color:#111;">
    <h2 style="margin:16px 0;">Thanks${userName ? `, ${sanitize(userName)}` : ""} — your order is confirmed!</h2>
    <p style="margin:0 0 12px;">Order ID: <b>${order.id}</b></p>

    <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #eee;">
      <thead>
        <tr style="background:#fafafa">
          <th align="left" style="padding:10px 12px;font-size:14px;">Item</th>
          <th align="center" style="padding:10px 12px;font-size:14px;">Qty</th>
          <th align="right" style="padding:10px 12px;font-size:14px;">Price</th>
        </tr>
      </thead>
      <tbody>${lines}</tbody>
      <tfoot>
        <tr><td colspan="2" align="right" style="padding:8px 12px;">Subtotal</td><td align="right" style="padding:8px 12px;">${inrFmt.format(subtotal/100)}</td></tr>
        ${order.discountCents ? `<tr><td colspan="2" align="right" style="padding:8px 12px;">Discount</td><td align="right" style="padding:8px 12px;">-${inrFmt.format(order.discountCents/100)}</td></tr>` : ""}
        <tr><td colspan="2" align="right" style="padding:8px 12px;"><b>Total</b></td><td align="right" style="padding:8px 12px;"><b>${inrFmt.format(order.totalCents/100)}</b></td></tr>
      </tfoot>
    </table>

    <div style="text-align:center;margin:24px 0 8px;">
      <a href="${orderUrl}" style="
        display:inline-block;
        padding:12px 20px;
        border-radius:999px;
        background:#111;
        color:#fff;
        text-decoration:none;
        font-weight:600;
      ">View Order</a>
    </div>

    <p style="font-size:13px;color:#555;margin-top:8px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <span style="word-break:break-all;">${orderUrl}</span>
    </p>

    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="font-size:12px;color:#777;margin:0;">This is a transactional email about your purchase on FluxCart.</p>
  </div>
  `;
}

function renderOrderEmailText(
  order: {
    id: string;
    totalCents: number;
    discountCents: number;
    items: { qty: number; priceCents: number; product: { title: string } }[];
  },
  webUrl = WEB_URL
) {
  const subtotal = order.items.reduce((s, it) => s + it.qty * it.priceCents, 0);
  const lines = order.items.map((it) => `- ${it.product.title}  x${it.qty}  ${inrFmt.format(it.priceCents / 100)}`).join("\n");
  const url = `${webUrl.replace(/\/$/, "")}/orders/${order.id}`;
  return [
    `Your order is confirmed!`,
    `Order ID: ${order.id}`,
    ``,
    `Items:`,
    lines,
    ``,
    `Subtotal: ${inrFmt.format(subtotal / 100)}`,
    ...(order.discountCents ? [`Discount: -${inrFmt.format(order.discountCents / 100)}`] : []),
    `Total: ${inrFmt.format(order.totalCents / 100)}`,
    ``,
    `View your order: ${url}`,
  ].join("\n");
}

// Prevent duplicates via optional Order.emailSent; allow forced resend; BCC support
async function sendOrderEmail(userId: string, orderId: string, opts?: { force?: boolean }) {
  try {
    const isConfigured = Boolean((mailer as any)?.transporter?.options?.host || process.env.EMAIL_SERVER);
    if (!isConfigured) return;

    const [user, order] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: { select: { title: true } } } } },
      }),
    ]);
    if (!user?.email || !order) return;

    const html = renderOrderEmailHTML(order, user.name || undefined, WEB_URL);
    const text = renderOrderEmailText(order, WEB_URL);

    await mailer.sendMail({
      from: EMAIL_FROM,
      to: user.email,
      ...(EMAIL_BCC ? { bcc: EMAIL_BCC } : {}),
      subject: `Your FluxCart order ${order.id} is confirmed`,
      html,
      text,
    });
  } catch (err) {
    app.log.warn({ err }, "Failed to send order email");
  }
}

/* ---------------- Helpers ---------------- */
const PHONE_RE = /^\+?\d{7,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DISCOUNT_THRESHOLD = 1000 * 100; // ₹1000 in paise
function calcDiscount(subtotalCents: number): number {
  return subtotalCents >= DISCOUNT_THRESHOLD ? Math.floor(subtotalCents * 0.1) : 0;
}

/** Resolve a user for this request (email, phone, or dev id). */
async function resolveUserId(req: any): Promise<string | null> {
  const hdrRaw = (req.headers["x-user-id"] as string) || "";
  const hdr = hdrRaw.trim();

  if (hdr) {
    if (EMAIL_RE.test(hdr)) {
      const u = await prisma.user.upsert({
        where: { email: hdr },
        update: {},
        create: { email: hdr, name: hdr.split("@")[0] },
      });
      return u.id;
    }
    if (PHONE_RE.test(hdr)) {
      const existing = await prisma.user.findUnique({ where: { phone: hdr } });
      const name = existing?.name ?? hdr.replace(/^\+?(\d{2})\d+$/, "+$1•••");
      const u = await prisma.user.upsert({
        where: { phone: hdr },
        update: existing ? {} : { name },
        create: { phone: hdr, name },
      });
      return u.id;
    }
    const devAlias = hdr.slice(0, 12) || "dev";
    const u = await prisma.user.upsert({
      where: { email: `${devAlias}@dev.local` },
      update: {},
      create: { email: `${devAlias}@dev.local`, name: "Dev User" },
    });
    return u.id;
  }

  let dev = await prisma.user.findFirst({ where: { email: "dev@fluxcart.local" } });
  if (!dev) dev = await prisma.user.create({ data: { email: "dev@fluxcart.local", name: "Dev User" } });
  return dev.id;
}

// ---------------- Health ----------------
app.get("/health", async () => ({ ok: true }));

/* =========================
   PROFILE ENDPOINTS
   ========================= */

// Very tolerant schema: accepts "", nulls, numbers (coerced), and ignores unknown props.
const ProfileSchema = z
  .object({
    name: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().trim().max(120).optional()),

    avatarUrl: z
      .preprocess((v) => (v === "" ? null : v), z.string().url().max(512).nullable().optional()),

    bio: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().max(2000).optional()),

    phone: z
      .preprocess((v) => {
        if (v === "") return null;
        if (typeof v === "number") return String(v);
        if (typeof v === "string") return v.trim();
        return v;
      }, z.union([z.string(), z.null()]).optional())
      .refine((v) => v == null || PHONE_RE.test(v), {
        message: "Phone must be +######## with 7–15 digits",
      }),

    addressLine1: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().max(191).optional()),
    addressLine2: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().max(191).optional()),
    city: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().max(96).optional()),
    state: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().max(96).optional()),
    postalCode: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().max(32).optional()),
    country: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().max(64).optional()),
    defaultCurrency: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().max(8).optional()),
    preferences: z.any().optional(),
  })
  .passthrough();

const profileSelect = {
  id: true,
  email: true,
  phone: true,
  name: true,
  image: true, // returned as avatarUrl
  bio: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  defaultCurrency: true,
  preferences: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

async function handleGetMe(req: any, reply: any) {
  const userId = await resolveUserId(req);
  if (!userId) return reply.code(401).send({ error: "No user" });

  const u = await prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
  if (!u) return reply.code(404).send({ error: "Not found" });

  return reply.send({ ...u, avatarUrl: u.image ?? null });
}

async function handleUpdateMe(req: any, reply: any) {
  const userId = await resolveUserId(req);
  if (!userId) return reply.code(401).send({ error: "No user" });

  const parsed = ProfileSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    app.log.warn({ issues: parsed.error.issues }, "Profile validation failed");
    return reply.code(400).send({ error: "Invalid body" });
  }
  const data = parsed.data;

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name ?? undefined,
        image: data.avatarUrl ?? undefined,
        bio: data.bio ?? undefined,
        phone: (data.phone as string | null) ?? undefined,
        addressLine1: data.addressLine1 ?? undefined,
        addressLine2: data.addressLine2 ?? undefined,
        city: data.city ?? undefined,
        state: data.state ?? undefined,
        postalCode: data.postalCode ?? undefined,
        country: data.country ?? undefined,
        defaultCurrency: data.defaultCurrency ?? undefined,
        preferences: data.preferences ?? undefined,
      },
      select: profileSelect,
    });

    return reply.send({ ...updated, avatarUrl: updated.image ?? null });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return reply.code(409).send({ error: "Phone is already in use by another account" });
    }
    app.log.error({ err }, "Profile update failed");
    return reply.code(500).send({ error: "Failed to update profile" });
  }
}

// Canonical routes
app.get("/me", handleGetMe);
app.put("/me", handleUpdateMe);

// Aliases your UI might call
app.get("/me/profile", handleGetMe);
app.post("/me/profile", handleUpdateMe);

/* =========================
   PRODUCTS
   ========================= */

app.post("/auth/sync", async (req, reply) => {
  const dto = (req.body ?? {}) as { phone?: string; name?: string };
  const phone = (dto.phone || "").trim();
  const name = (dto.name || "").trim().slice(0, 64) || undefined;

  if (!PHONE_RE.test(phone)) return reply.code(400).send({ error: "Invalid phone" });

  const existing = await prisma.user.findUnique({ where: { phone } });
  const u = await prisma.user.upsert({
    where: { phone },
    update: name && !existing?.name ? { name } : {},
    create: { phone, name: name ?? phone.replace(/^\+?(\d{2})\d+$/, "+$1•••") },
  });
  return { id: u.id, phone: u.phone, name: u.name };
});

// Dev helpers
app.post("/dev/reindex", async () => {
  if (!meili) return { ok: false, msg: "Meilisearch not configured" };
  const idx = meili.index("products");
  const products = await prisma.product.findMany();
  await idx.addDocuments(
    products.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      description: p.description,
      priceCents: p.priceCents,
      rating: p.rating,
      category: (p as any).category ?? null,
    }))
  );
  return { ok: true, count: products.length };
});

app.post("/dev/clear-cart", async (req, reply) => {
  const userId = await resolveUserId(req);
  if (!userId) return reply.code(401).send({ error: "No user" });
  const res = await prisma.cartItem.deleteMany({ where: { userId } });
  return { ok: true, deleted: res.count };
});

app.get("/products", async (req) => {
  const q = (req.query as any).q ?? "";
  const limit = Number((req.query as any).limit ?? 24);
  const offset = Number((req.query as any).offset ?? 0);
  const category = ((req.query as any).category as string | undefined)?.trim();

  const wherePg: Prisma.ProductWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {},
      category ? { category: { equals: category } } : {},
    ],
  };

  const pgSearch = async () => {
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where: wherePg,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where: wherePg }),
    ]);
    return { items, total };
  };

  if (meili && q) {
    try {
      const idx = meili.index("products");
      const res = await idx.search(q, {
        limit,
        offset,
        filter: category ? `category = "${category}"` : undefined,
      });
      const ids = (res.hits as any[]).map((h) => h.id);
      if (!ids.length) return { items: [], total: 0 };
      const items = await prisma.product.findMany({
        where: { id: { in: ids }, ...(category ? { category } : {}) },
        take: limit,
        skip: offset,
      });
      return { items, total: (res as any).estimatedTotalHits ?? items.length };
    } catch {
      return pgSearch();
    }
  }
  return pgSearch();
});

app.get("/products/categories", async () => {
  const rows = await prisma.product.findMany({
    select: { category: true },
    where: { NOT: { category: null } },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return rows.map((r) => (r as any).category).filter(Boolean);
});

app.get("/products/:slug", async (req, reply) => {
  const { slug } = req.params as any;
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) return reply.code(404).send({ error: "Not found" });
  return product;
});

/* =========================
   CART
   ========================= */

const CartItemSchema = z.object({
  productId: z.string(),
  qty: z.number().int().positive().default(1),
  kind: z.enum(["BUY", "RENT", "SWAP"]).default("BUY"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

app.get("/cart", async (req, reply) => {
  const userId = await resolveUserId(req);
  if (!userId) return reply.code(401).send({ error: "No user" });

  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: true },
    orderBy: { createdAt: "asc" },
  });

  return items;
});

app.post("/cart/items", async (req, reply) => {
  const userId = await resolveUserId(req);
  if (!userId) return reply.code(401).send({ error: "No user" });

  const parsed = CartItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid body", details: parsed.error.flatten() });
  }

  const data = parsed.data;

  const item = await prisma.cartItem.create({
    data: {
      userId,
      productId: data.productId,
      qty: data.qty,
      kind: data.kind,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      holdId: `hold_${Math.random().toString(36).slice(2)}`,
    },
    include: { product: true },
  });

  return item;
});

const UpdateQtySchema = z.object({
  qty: z.number().int().min(0), // 0 deletes
});

app.patch("/cart/items/:id", async (req, reply) => {
  const userId = await resolveUserId(req);
  if (!userId) return reply.code(401).send({ error: "No user" });

  const { id } = req.params as { id: string };
  const parsed = UpdateQtySchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid qty", details: parsed.error.flatten() });
  }

  const existing = await prisma.cartItem.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return reply.code(404).send({ error: "Not found" });
  }

  const qty = parsed.data.qty;
  if (qty <= 0) {
    await prisma.cartItem.delete({ where: { id } });
    return { ok: true, deleted: true };
  }

  const updated = await prisma.cartItem.update({
    where: { id },
    data: { qty },
    include: { product: true },
  });
  return updated;
});

app.delete("/cart/items/:id", async (req, reply) => {
  const userId = await resolveUserId(req);
  if (!userId) return reply.code(401).send({ error: "No user" });

  const { id } = req.params as { id: string };

  const existing = await prisma.cartItem.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return reply.code(404).send({ error: "Not found" });
  }

  await prisma.cartItem.delete({ where: { id } });
  return { ok: true };
});

/* =========================
   CHECKOUT / ORDERS
   ========================= */

app.post("/checkout/session", async (req, reply) => {
  const userId = await resolveUserId(req);
  if (!userId) return reply.code(401).send({ error: "No user" });

  const headerUid = (req.headers["x-user-id"] as string) || "";
  const items = await prisma.cartItem.findMany({ where: { userId }, include: { product: true } });
  if (items.length === 0) return reply.code(400).send({ error: "Cart empty" });

  const subtotalCents = items.reduce((sum, it) => sum + it.product.priceCents * it.qty, 0);
  const discountCents = calcDiscount(subtotalCents);

  if (!stripe) {
    const data: any = {
      userId,
      status: "PAID",
      totalCents: subtotalCents - discountCents,
      discountCents,
      items: {
        create: items.map((it) => ({
          productId: it.productId,
          kind: it.kind,
          qty: it.qty,
          priceCents: it.product.priceCents,
        })),
      },
    };
    const order = await prisma.order.create({ data });
    await prisma.cartItem.deleteMany({ where: { userId } });

    // best-effort receipt
    sendOrderEmail(userId, order.id).catch(() => {});
    return { url: `${WEB_URL}/orders/${order.id}?simulated=1` };
  }

  const line_items = items.map((it) => ({
    price_data: {
      currency: (it.product.currency || "INR").toLowerCase(),
      product_data: {
        name: it.product.title,
        images: it.product.images?.slice(0, 1) || [],
      },
      unit_amount: it.product.priceCents,
    },
    quantity: it.qty,
  }));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items,
    success_url: `${WEB_URL}/orders?paid=1&sid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${WEB_URL}/cart`,
    metadata: {
      userId,
      headerUid,
      subtotalCents: String(subtotalCents),
      discountCents: String(discountCents),
    },
  });

  return { url: session.url };
});

// Stripe webhook
app.post("/webhooks/stripe", { config: { rawBody: true } }, async (req, reply) => {
  if (!stripe) return reply.code(200).send({ ok: true });

  const sig = req.headers["stripe-signature"] as string | undefined;
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whsec) return reply.code(400).send({ error: "Missing signature/secret" });

  let event: Stripe.Event;
  try {
    const raw = (req as any).rawBody as string;
    event = stripe.webhooks.constructEvent(raw, sig, whsec);
  } catch (err: any) {
    req.log.error({ err }, "Stripe signature verify failed");
    return reply.code(400).send({ error: "Bad signature" });
  }

  if (event.type === "checkout.session.completed") {
    const sess = event.data.object as Stripe.Checkout.Session;
    await finalizePaidSession(sess, req);
  }

  return reply.send({ received: true });
});

app.get("/checkout/confirm", async (req, reply) => {
  if (!stripe) return reply.code(400).send({ error: "Stripe not configured" });
  const sid = (req.query as any).sid as string;
  if (!sid) return reply.code(400).send({ error: "Missing sid" });

  try {
    const sess = await stripe.checkout.sessions.retrieve(sid);
    if (sess.payment_status !== "paid") {
      return reply.code(400).send({ error: `Session not paid: ${sess.payment_status}` });
    }
    await finalizePaidSession(sess as any, req);
    return { ok: true };
  } catch (err: any) {
    req.log.error({ err }, "checkout.confirm failed");
    return reply.code(500).send({ error: "confirm failed" });
  }
});

async function finalizePaidSession(sess: Stripe.Checkout.Session, req: any) {
  let targetUserId = sess.metadata?.userId || "";
  const headerUid = (sess.metadata?.headerUid || "").trim();

  if (!targetUserId && headerUid) {
    if (EMAIL_RE.test(headerUid)) {
      const u = await prisma.user.findUnique({ where: { email: headerUid } });
      if (u) targetUserId = u.id;
    } else if (PHONE_RE.test(headerUid)) {
      const u = await prisma.user.findUnique({ where: { phone: headerUid } });
      if (u) targetUserId = u.id;
    }
  }

  if (!targetUserId) {
    req.log.error({ metadata: sess.metadata }, "No resolvable user id in metadata");
    return;
  }

  const items = await prisma.cartItem.findMany({
    where: { userId: targetUserId },
    include: { product: true },
  });

  if (items.length) {
    const subtotalCents = items.reduce((s, it) => s + it.product.priceCents * it.qty, 0);
    const metaDiscount = Number(sess.metadata?.discountCents ?? "0");
    const discountCents =
      Number.isFinite(metaDiscount) && metaDiscount >= 0 ? metaDiscount : calcDiscount(subtotalCents);

    const data: any = {
      userId: targetUserId,
      status: "PAID",
      totalCents: subtotalCents - discountCents,
      discountCents,
      items: {
        create: items.map((it) => ({
          productId: it.productId,
          kind: it.kind,
          qty: it.qty,
          priceCents: it.product.priceCents,
        })),
      },
    };
    const created = await prisma.order.create({ data });
    await prisma.cartItem.deleteMany({ where: { userId: targetUserId } });

    sendOrderEmail(targetUserId, created.id).catch(() => {});
  }
}

/* =========================
   ORDERS (list/detail/reorder/receipt)
   ========================= */

app.get("/orders", async (req, reply) => {
  const userId = await resolveUserId(req);
  if (!userId) return reply.code(401).send({ error: "No user" });
  const orders = await prisma.order.findMany({
    where: { userId },
    include: {
      items: {
        include: { product: { select: { id: true, title: true, slug: true, images: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return orders;
});

app.get("/orders/:id", async (req, reply) => {
  const userId = await resolveUserId(req);
  if (!userId) return reply.code(401).send({ error: "No user" });
  const { id } = req.params as any;
  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: {
      items: {
        include: { product: { select: { id: true, title: true, slug: true, images: true } } },
      },
    },
  });
  if (!order) return reply.code(404).send({ error: "Not found" });
  return order;
});

app.post("/orders/:id/reorder", async (req, reply) => {
  const userId = await resolveUserId(req);
  if (!userId) return reply.code(401).send({ error: "No user" });
  const { id } = req.params as any;
  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: { items: true },
  });
  if (!order) return reply.code(404).send({ error: "Not found" });

  let added = 0;
  for (const it of order.items) {
    if (it.kind !== "BUY") continue;
    await prisma.cartItem.create({
      data: {
        userId,
        productId: it.productId,
        qty: it.qty,
        kind: it.kind,
        holdId: `re_${Math.random().toString(36).slice(2)}`,
      },
    });
    added += 1;
  }
  return { ok: true, added };
});

// Resend receipt (owner-only)
app.post("/orders/:id/resend-email", async (req, reply) => {
  const userId = await resolveUserId(req);
  if (!userId) return reply.code(401).send({ error: "No user" });
  const { id } = req.params as any;

  const order = await prisma.order.findFirst({ where: { id, userId } });
  if (!order) return reply.code(404).send({ error: "Not found" });

  await sendOrderEmail(userId, id, { force: true });
  return { ok: true };
});

// PDF receipt (stream)
app.get("/orders/:id/receipt.pdf", async (req, reply) => {
  // resolve user from header; allow ?uid=... fallback
  let userId = await resolveUserId(req);
  if (!userId) {
    const uid = (req.query as any).uid as string | undefined;
    if (uid) {
      const u = await prisma.user.findFirst({
        where: { OR: [{ id: uid }, { email: uid }, { phone: uid }] },
      });
      userId = u?.id ?? null;
    }
  }
  if (!userId) return reply.code(401).send({ error: "No user" });

  const { id } = req.params as { id: string };
  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: { items: { include: { product: true } } },
  });
  if (!order) return reply.code(404).send({ error: "Not found" });

  reply.raw.setHeader("Content-Type", "application/pdf");
  reply.raw.setHeader("Content-Disposition", `inline; filename="order-${order.id}.pdf"`);

  const doc = new PDFDocument({ size: "A4", margin: 50 });

  doc.on("error", () => {
    try {
      if (!reply.raw.writableEnded) reply.raw.end();
    } catch {}
  });
  doc.on("end", () => {
    try {
      if (!reply.raw.writableEnded) reply.raw.end();
    } catch {}
  });

  doc.pipe(reply.raw);

  // Header / branding
  doc.fontSize(20).text("FluxCart Receipt", { align: "left" });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#666").text("Thank you for your purchase!");
  doc.moveDown();

  // Order meta
  doc.fillColor("#000").fontSize(12);
  doc.text(`Order ID: ${order.id}`);
  doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
  doc.moveDown();

  // Table header
  doc.font("Helvetica-Bold");
  doc.text("Item", 50, doc.y);
  doc.text("Qty", 350, doc.y);
  doc.text("Price", 400, doc.y, { align: "right" });
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.4);
  doc.font("Helvetica");

  // Lines
  let subtotal = 0;
  for (const it of order.items) {
    subtotal += it.qty * it.priceCents;
    doc.text(it.product.title, 50, doc.y, { width: 280 });
    doc.text(String(it.qty), 350, doc.y);
    doc.text(inrFmt.format(it.priceCents / 100), 400, doc.y, { align: "right" });
    doc.moveDown(0.2);
  }

  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  // Totals
  doc.text(`Subtotal: ${inrFmt.format(subtotal / 100)}`, { align: "right" });
  if (order.discountCents) {
    doc.text(`Discount: -${inrFmt.format(order.discountCents / 100)}`, { align: "right" });
  }
  doc.font("Helvetica-Bold");
  doc.text(`Total: ${inrFmt.format(order.totalCents / 100)}`, { align: "right" });
  doc.font("Helvetica");

  doc.moveDown();
  doc.fontSize(9).fillColor("#666").text("FluxCart · Transactional receipt", { align: "center" });

  doc.end();
});

/* =========================
   GROUP BUYS
   ========================= */

const CreateGB = z.object({
  productId: z.string(),
  minParticipants: z.number().int().positive(),
  deadline: z.string(),
});

app.get("/group-buys", async (req, reply) => {
  const { productId } = req.query as any;
  if (!productId) return reply.code(400).send({ error: "productId required" });

  const now = new Date();
  const gbs = await prisma.groupBuy.findMany({
    where: { productId, status: "OPEN", deadline: { gt: now } },
    include: { _count: { select: { participants: true } } },
    orderBy: { deadline: "asc" },
  });

  return gbs;
});

app.post("/group-buys", async (req, reply) => {
  const creatorId = await resolveUserId(req);
  if (!creatorId) return reply.code(401).send({ error: "No user" });
  const dto = CreateGB.parse(req.body);
  const gb = await prisma.groupBuy.create({
    data: {
      productId: dto.productId,
      creatorId,
      minParticipants: dto.minParticipants,
      deadline: new Date(dto.deadline),
    },
  });
  return gb;
});

app.post("/group-buys/:id/join", async (req, reply) => {
  const userId = await resolveUserId(req);
  if (!userId) return reply.code(401).send({ error: "No user" });
  const { id } = req.params as any;

  const gb = await prisma.groupBuy.findUnique({ where: { id }, include: { participants: true } });
  if (!gb) return reply.code(404).send({ error: "Not found" });
  if (gb.status !== "OPEN" || gb.deadline < new Date()) return reply.code(400).send({ error: "Closed" });
  if (gb.participants.some((p) => p.userId === userId)) return { ok: true };

  await prisma.groupBuyParticipant.create({ data: { groupBuyId: id, userId, intent: true } });
  return { ok: true };
});

app.get("/group-buys/:id", async (req, reply) => {
  const { id } = req.params as any;
  const gb = await prisma.groupBuy.findUnique({ where: { id }, include: { participants: true } });
  if (!gb) return reply.code(404).send({ error: "Not found" });
  return gb;
});

/* =========================
   START SERVER
   ========================= */

app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  console.log(`API running on http://localhost:${PORT}`);
});
