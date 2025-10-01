import { z } from "zod";

export const CartKind = z.enum(["BUY", "RENT", "SWAP"]);
export const Product = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  priceCents: z.number(),
  currency: z.string(),
  rating: z.number(),
  images: z.array(z.string())
});
export const CreateGroupBuy = z.object({
  productId: z.string(),
  minParticipants: z.number().int().positive(),
  deadline: z.string() // ISO date
});
export type TProduct = z.infer<typeof Product>;
export type TCartKind = z.infer<typeof CartKind>;
export type TCreateGroupBuy = z.infer<typeof CreateGroupBuy>;
