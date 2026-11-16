// まちの details（jsonb）の形。形は docs/proposals/web-output-building-hotspring-village.html。必須かどうかは quality.ts が決める
import { z } from "zod";
import { localizedTextSchema, sourceSchema, timeSchema } from "../accommodation/details.ts";
import { accessSchema, cautionSchema, eventSchema } from "../place-common.ts";

export const walkKeySchema = z.string().regex(/^[a-z0-9_-]{1,40}$/, "歩き方の key は英小文字・数字・_・- の 1〜40 文字");

export const walkSchema = z.strictObject({
  key: walkKeySchema,
  name: localizedTextSchema,
  area: localizedTextSchema.optional(),
  duration_minutes: z.int().positive().optional(),
  distance_km: z.number().nonnegative().optional(),
  note: localizedTextSchema.optional(),
});

export const shopHoursSchema = z.strictObject({
  open: timeSchema.optional(),
  close: timeSchema.optional(),
  note: localizedTextSchema.optional(),
});

export const villageDetailsSchema = z
  .strictObject({
    walks: z.array(walkSchema).optional(),
    shop_hours: shopHoursSchema.optional(), // 配列でなく 1 つ
    events: z.array(eventSchema).optional(),
    access: accessSchema.optional(), // 配列でなく 1 つ
    cautions: z.array(cautionSchema).optional(),
    sources: z.array(sourceSchema).optional(),
  })
  .superRefine((d, ctx) => {
    // walks[].key は dest の中で一意
    const seen = new Set<string>();
    (d.walks ?? []).forEach((w, i) => {
      if (seen.has(w.key)) ctx.addIssue({ code: "custom", path: ["walks", i, "key"], message: `歩き方の key が重なっている: ${w.key}` });
      seen.add(w.key);
    });
  });

export type VillageDetails = z.infer<typeof villageDetailsSchema>;
export type Walk = z.infer<typeof walkSchema>;
export type VillageShopHours = z.infer<typeof shopHoursSchema>;
