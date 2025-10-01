/* CSV columns: id,title,slug,description,priceCents,currency,rating,images,stock,category
   - images: JSON array (["/catalog/...","..."]) OR pipe list (url1|url2|file3.jpg)
   - If an image is just a filename and category is present, we build:
       <BASE>/<Category>/<filename>
     where BASE is:
       1) CLI --base=... (highest precedence)
       2) env ASSET_BASE_URL (e.g. https://cdn.example.com/catalog)
       3) /catalog (default; served from apps/web/public/catalog)
   Usage:
     pnpm -C apps/api run import:products path/to/products.csv
     pnpm -C apps/api run import:products -- --dry path/to/products.csv
     pnpm -C apps/api run import:products -- --base=/catalog path/to/products.csv
*/
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** ---------- CLI flags ---------- */
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry");
const baseArg = argv.find((a) => a.startsWith("--base="));
const CLI_BASE = baseArg ? baseArg.split("=")[1] : undefined;

/** ---------- Base URL logic ---------- */
const ENV_BASE = (process.env.ASSET_BASE_URL || "").replace(/\/+$/, "");
const DEFAULT_BASE = "/catalog";
const IMAGE_BASE = (CLI_BASE ?? ENV_BASE ?? DEFAULT_BASE).replace(/\/+$/, "");

/** ---------- Utils ---------- */
function isHttpOrRoot(u: string) {
  return /^https?:\/\//i.test(u) || u.startsWith("/");
}

function safeNumber(n: any, fallback = 0) {
  const v = Number(String(n ?? "").trim());
  return Number.isFinite(v) ? v : fallback;
}

function normalizeCategory(cat: string | null | undefined) {
  if (!cat) return null;
  return cat.trim() || null;
}

function buildImageUrl(raw: string, category: string | null) {
  const s = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!s) return null;
  if (isHttpOrRoot(s)) return s; // already a full URL or absolute path

  // filename only -> require category to build the path
  if (!category) return `/${s}`; // fallback to root just in case
  return `${IMAGE_BASE}/${category}/${s}`.replace(/([^:]\/)\/+/g, "$1");
}

/** Robust CSV parser (quoted fields + commas) */
function parseCSV(text: string) {
  const rows: Record<string, string>[] = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);

  if (!lines.length) return rows;

  const header = splitCSVLine(lines[0]);
  for (let li = 1; li < lines.length; li++) {
    const raw = lines[li];
    if (!raw || /^\s*(#|\/\/)/.test(raw)) continue; // skip empty/comment lines
    const cols = splitCSVLine(raw);
    const obj: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) {
      obj[header[i]] = (cols[i] ?? "").trim();
    }
    if (Object.values(obj).every((v) => v === "")) continue; // skip empty records
    rows.push(obj);
  }
  return rows;
}

/** Split a CSV line respecting quotes */
function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'; i++; // escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Parse images as JSON array OR as pipe list */
function parseImagesCell(cell: string, category: string | null): string[] {
  const raw = (cell || "").trim();
  if (!raw) return [];

  // JSON array?
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const arr = JSON.parse(raw) as unknown[];
      return (Array.isArray(arr) ? arr : [])
        .map((s) => buildImageUrl(String(s), category))
        .filter(Boolean) as string[];
    } catch {
      // fall through to pipe list if JSON parse fails
    }
  }

  // pipe-separated list
  return raw
    .split("|")
    .map((s) => buildImageUrl(s, category))
    .filter(Boolean) as string[];
}

/** ---------- Importer ---------- */
async function main() {
  const file = argv.filter((a) => !a.startsWith("--"))[0];
  if (!file) {
    throw new Error("Usage: import-products.ts [--dry] [--base=/catalog] <file.csv>");
  }
  const csv = readFileSync(file, "utf8");
  const rows = parseCSV(csv);

  let upserts = 0;
  for (const r of rows) {
    const slug = (r.slug || "").trim();
    const title = (r.title || "").trim();
    if (!slug || !title) continue;

    const category = normalizeCategory(r.category);
    const images = parseImagesCell(r.images, category);

    const data = {
      title,
      slug,
      description: r.description || "",
      priceCents: safeNumber(r.priceCents, 0),
      currency: (r.currency || "INR").trim() || "INR",
      rating: safeNumber(r.rating, 0),
      images,
      stock: safeNumber(r.stock, 100),
      category,
    } as const;

    if (DRY_RUN) {
      console.log(`[DRY] upsert ${slug} →`, { ...data, imagesCount: images.length });
      upserts++;
      continue;
    }

    await prisma.product.upsert({
      where: { slug },
      update: data,
      create: data,
    });
    upserts++;
  }

  console.log(
    `${DRY_RUN ? "Would import/update" : "Imported/updated"} ${upserts} products. ` +
      `(IMAGE_BASE=${IMAGE_BASE || "(none)"})`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
