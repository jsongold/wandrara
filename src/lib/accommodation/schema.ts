// 宿の details 全体（details.ts の欄 + prices）。bundle・API の details はこれで確かめる。
// prices の room が rooms の key に実在するかは、両方が揃うここで確かめる
import { z } from "zod";
import { detailsBaseSchema } from "./details.ts";
import { pricesSchema } from "./prices.ts";

export const accommodationDetailsSchema = detailsBaseSchema
  .safeExtend({ prices: pricesSchema.optional() })
  .superRefine((d, ctx) => {
    const rooms = new Set((d.rooms ?? []).map((r) => r.key));
    (d.prices?.items ?? []).forEach((it, i) => {
      if (it.room !== undefined && !rooms.has(it.room))
        ctx.addIssue({ code: "custom", path: ["prices", "items", i, "room"], message: `部屋 ${it.room} が rooms の key に無い` });
    });
  });

export type AccommodationDetails = z.infer<typeof accommodationDetailsSchema>;
