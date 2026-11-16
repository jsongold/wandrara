CREATE TABLE "region_parts" (
	"region_id" text NOT NULL,
	"source" text NOT NULL,
	"source_version" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "region_parts_pkey" PRIMARY KEY("source","source_version","code"),
	CONSTRAINT "region_parts_source_check" CHECK ("region_parts"."source" in ('n03', 'estat'))
);
--> statement-breakpoint
ALTER TABLE "region_parts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN "lat" double precision;--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN "lng" double precision;--> statement-breakpoint
ALTER TABLE "region_parts" ADD CONSTRAINT "region_parts_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "anyone read" ON "region_parts" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);