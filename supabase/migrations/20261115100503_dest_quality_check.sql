CREATE TABLE "dest_quality_check" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"quality" integer NOT NULL,
	"reason" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dest_quality_check_dest_id_unique" UNIQUE("dest_id"),
	CONSTRAINT "dest_quality_check_quality_check" CHECK ("dest_quality_check"."quality" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "dest_quality_check" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dest_quality_check" ADD CONSTRAINT "dest_quality_check_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;