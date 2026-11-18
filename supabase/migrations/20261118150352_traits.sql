CREATE TABLE "region_traits" (
	"region_id" text NOT NULL,
	"trait_id" text NOT NULL,
	"value" double precision NOT NULL,
	"source_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "region_traits_pkey" PRIMARY KEY("region_id","trait_id")
);
--> statement-breakpoint
ALTER TABLE "region_traits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "traits" (
	"id" text PRIMARY KEY NOT NULL,
	"name" jsonb NOT NULL,
	"icon" text DEFAULT 'tag' NOT NULL,
	"sort" integer,
	"value_type" text DEFAULT 'flag' NOT NULL,
	"unit" text,
	"steps" jsonb,
	"source" text NOT NULL,
	"category_ids" text[],
	"method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "traits_id_check" CHECK ("traits"."id" ~ '^[a-z0-9-]{1,40}$'),
	CONSTRAINT "traits_value_type_check" CHECK ("traits"."value_type" in ('flag', 'number')),
	CONSTRAINT "traits_source_check" CHECK ("traits"."source" in ('items', 'geo'))
);
--> statement-breakpoint
ALTER TABLE "traits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "region_traits" ADD CONSTRAINT "region_traits_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_traits" ADD CONSTRAINT "region_traits_trait_id_traits_id_fk" FOREIGN KEY ("trait_id") REFERENCES "public"."traits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "anyone read" ON "region_traits" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "anyone read" ON "traits" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
-- 権限：このプロジェクトでは新しい表に権限が自動で付かないので明示する（行の可否は RLS の anyone read）
grant select on public.traits, public.region_traits to anon, authenticated;--> statement-breakpoint
grant all on public.traits, public.region_traits to service_role;--> statement-breakpoint
-- 最初の特性：公開中の宿・体験の分類から数えるもの。土地から計算する特性（海沿い・標高）は後で足す
insert into public.traits (id, name, icon, sort, value_type, source, category_ids) values
  ('onsen', '{"ja":"温泉","en":"Onsen"}', 'steam', 10, 'flag', 'items', array['onsen', 'onsentown']),
  ('coast', '{"ja":"海辺","en":"Coast"}', 'sun', 20, 'flag', 'items', array['coast', 'beach']),
  ('plateau', '{"ja":"高原","en":"Highlands"}', 'tree', 30, 'flag', 'items', array['plateau']),
  ('lake', '{"ja":"湖畔","en":"Lakeside"}', 'wave', 40, 'flag', 'items', array['lake']),
  ('hike', '{"ja":"山歩き","en":"Hiking"}', 'hike', 50, 'flag', 'items', array['hike'])
on conflict (id) do nothing;
