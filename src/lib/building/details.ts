// 建物の details（jsonb）の形。形は docs/proposals/web-output-building-hotspring-village.html。必須かどうかは quality.ts が決める
import { z } from "zod";
import { bookingLinkSchema, localizedTextSchema, sourceSchema } from "../accommodation/details.ts";
import { accessSchema, cautionSchema, checkFee, eventSchema, feeShape, hoursSchema } from "../place-common.ts";

export const buildingFeeSchema = z.strictObject({ label: localizedTextSchema.optional(), ...feeShape }).superRefine(checkFee);

export const buildingDetailsSchema = z.strictObject({
  hours: hoursSchema.optional(), // 配列でなく 1 つ
  fees: z.array(buildingFeeSchema).optional(),
  events: z.array(eventSchema).optional(),
  access: accessSchema.optional(), // 配列でなく 1 つ
  cautions: z.array(cautionSchema).optional(),
  booking_links: z.array(bookingLinkSchema).optional(),
  sources: z.array(sourceSchema).optional(),
});

export type BuildingDetails = z.infer<typeof buildingDetailsSchema>;
export type BuildingFee = z.infer<typeof buildingFeeSchema>;
