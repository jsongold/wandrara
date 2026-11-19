// 体験の details（jsonb）の形。形は docs/proposals/web-output-experience-nature.html。必須かどうかは quality.ts が決める
// 共通の値（LocalizedText・時刻・金額・出典）は宿と同じものを使う
import { z } from "zod";
import { GEO_PRECISIONS } from "../../db/schema/_shared.ts";
import { bookingLinkSchema, cautionSchema, currencySchema, sourceSchema, timeSchema } from "../accommodation/details.ts";
import { languageTagSchema, localizedTextSchema } from "../i18n/localized.ts";
import { AUDIENCES, INCLUSION_KINDS, LOCATION_KINDS, PRICE_PERS } from "../vocab/experience.ts";

export const courseKeySchema = z.string().regex(/^[a-z0-9_-]{1,40}$/, "コースの key は英小文字・数字・_・- の 1〜40 文字");

const nonneg = z.number().nonnegative();
const count = z.int().positive();
const age = z.int().nonnegative();
const month = z.int().min(1).max(12);

export const courseSchema = z
  .strictObject({
    key: courseKeySchema,
    name: localizedTextSchema,
    description: localizedTextSchema.optional(),
    duration_minutes: count.optional(),
    people_min: count.optional(),
    people_max: count.optional(),
    age_min: age.optional(),
    languages: z.array(languageTagSchema).optional(),
  })
  .superRefine((c, ctx) => {
    if (c.people_min !== undefined && c.people_max !== undefined && c.people_min > c.people_max)
      ctx.addIssue({ code: "custom", path: ["people_max"], message: "people_max が people_min より小さい" });
  });

export const priceItemSchema = z
  .strictObject({
    course: courseKeySchema.optional(), // courses[].key。空なら全コース
    per: z.enum(PRICE_PERS),
    audience: z.enum(AUDIENCES).optional(),
    age_min: age.optional(),
    age_max: age.optional(),
    people_min: count.optional(),
    people_max: count.optional(),
    amount: nonneg,
    amount_max: nonneg.optional(),
    currency: currencySchema,
    tax_included: z.boolean().optional(),
  })
  .superRefine((p, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (p.people_min !== undefined && p.people_max !== undefined && p.people_min > p.people_max) issue("people_max", "people_max が people_min より小さい");
    if (p.age_min !== undefined && p.age_max !== undefined && p.age_min > p.age_max) issue("age_max", "age_max が age_min より小さい");
    if (p.amount_max !== undefined && p.amount > p.amount_max) issue("amount_max", "amount_max が amount より小さい");
  });

export const scheduleSchema = z
  .strictObject({
    months_from: month.optional(),
    months_to: month.optional(),
    weekdays: z.array(z.int().min(1).max(7)).optional(), // 1=月 … 7=日
    start_times: z.array(timeSchema).optional(),
    end_time: timeSchema.optional(),
    rain_policy: localizedTextSchema.optional(),
  })
  .superRefine((s, ctx) => {
    if (s.weekdays && new Set(s.weekdays).size !== s.weekdays.length) ctx.addIssue({ code: "custom", path: ["weekdays"], message: "曜日が重なっている" });
  });

export const locationSchema = z.strictObject({
  kind: z.enum(LOCATION_KINDS),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  geo_precision: z.enum(GEO_PRECISIONS),
  address: localizedTextSchema.optional(),
  note: localizedTextSchema.optional(),
});

export const inclusionSchema = z.strictObject({ kind: z.enum(INCLUSION_KINDS), item: localizedTextSchema });

export const experienceDetailsSchema = z
  .strictObject({
    courses: z.array(courseSchema).optional(),
    prices: z.strictObject({ items: z.array(priceItemSchema) }).optional(),
    schedules: z.array(scheduleSchema).optional(),
    locations: z.array(locationSchema).optional(),
    inclusions: z.array(inclusionSchema).optional(),
    cautions: z.array(cautionSchema).optional(),
    booking_links: z.array(bookingLinkSchema).optional(),
    sources: z.array(sourceSchema).optional(),
  })
  .superRefine((d, ctx) => {
    // courses[].key は dest の中で一意
    const keys = new Set<string>();
    (d.courses ?? []).forEach((c, i) => {
      if (keys.has(c.key)) ctx.addIssue({ code: "custom", path: ["courses", i, "key"], message: `コースの key が重なっている: ${c.key}` });
      keys.add(c.key);
    });
    // 料金の course は courses の key に実在する
    (d.prices?.items ?? []).forEach((it, i) => {
      if (it.course !== undefined && !keys.has(it.course))
        ctx.addIssue({ code: "custom", path: ["prices", "items", i, "course"], message: `コース ${it.course} が courses の key に無い` });
    });
  });

export type ExperienceDetails = z.infer<typeof experienceDetailsSchema>;
export type Course = z.infer<typeof courseSchema>;
export type ExperiencePriceItem = z.infer<typeof priceItemSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type ExperienceLocation = z.infer<typeof locationSchema>;
export type Inclusion = z.infer<typeof inclusionSchema>;
