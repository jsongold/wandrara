// 日帰り温泉の details（jsonb）の形。形は docs/proposals/web-output-building-hotspring-village.html。必須かどうかは quality.ts が決める
import { z } from "zod";
import { moneySchema, sourceSchema } from "../accommodation/details.ts";
import { localizedTextSchema } from "../i18n/localized.ts";
import { accessSchema, cautionSchema, checkFee, feeShape, hoursSchema } from "../place-common.ts";
import { BATH_GENDERS, BATH_KINDS, HOT_SPRING_SOURCES, TOWELS } from "../vocab/hotspring.ts";

export const hotspringBathSchema = z.strictObject({
  kind: z.enum(BATH_KINDS),
  hot_spring: z.boolean().optional(),
  spring: z.string().optional(), // 泉質（例: アルカリ性単純温泉）
  source: z.enum(HOT_SPRING_SOURCES).optional(),
  gender: z.enum(BATH_GENDERS).optional(),
  fee: moneySchema.optional(), // 貸切風呂など別料金のとき
  reservation: z.strictObject({ required: z.boolean(), slot_minutes: z.int().positive().optional() }).optional(),
  note: localizedTextSchema.optional(),
});

export const hotspringFeeSchema = z.strictObject(feeShape).superRefine(checkFee);

export const hotspringAmenitiesSchema = z.strictObject({
  towel: z.enum(TOWELS).optional(),
  towel_fee: moneySchema.optional(),
  rest_area: z.boolean().optional(),
  meal: z.boolean().optional(),
  note: localizedTextSchema.optional(),
});

export const hotspringDetailsSchema = z.strictObject({
  baths: z.array(hotspringBathSchema).optional(),
  hours: hoursSchema.omit({ note: true }).optional(), // 配列でなく 1 つ
  fees: z.array(hotspringFeeSchema).optional(),
  amenities: hotspringAmenitiesSchema.optional(),
  access: accessSchema.optional(), // 配列でなく 1 つ
  cautions: z.array(cautionSchema).optional(),
  sources: z.array(sourceSchema).optional(),
});

export type HotspringDetails = z.infer<typeof hotspringDetailsSchema>;
export type HotspringBath = z.infer<typeof hotspringBathSchema>;
export type HotspringFee = z.infer<typeof hotspringFeeSchema>;
export type HotspringAmenities = z.infer<typeof hotspringAmenitiesSchema>;
