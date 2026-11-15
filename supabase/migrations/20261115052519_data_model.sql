CREATE TABLE "accommodation_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"nearest_station" text,
	"station_minutes" integer,
	"has_shuttle" boolean,
	"has_slope_or_stairs" boolean,
	"needs_car" boolean,
	"winter_restriction" jsonb,
	"note" jsonb
);
--> statement-breakpoint
ALTER TABLE "accommodation_access" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accommodation_amenities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"unit_id" uuid,
	"kind" text NOT NULL,
	"is_paid" boolean,
	"note" jsonb
);
--> statement-breakpoint
ALTER TABLE "accommodation_amenities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accommodation_baths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"unit_id" uuid,
	"kind" text,
	"source_type" text,
	"spring" text,
	"open_from" time,
	"open_to" time,
	"needs_reservation" boolean,
	"amount" numeric,
	"currency" text,
	"swaps_by_gender" boolean,
	"note" jsonb,
	CONSTRAINT "accommodation_baths_kind_check" CHECK ("accommodation_baths"."kind" in ('public', 'open_air', 'private', 'room_open_air', 'room')),
	CONSTRAINT "accommodation_baths_source_type_check" CHECK ("accommodation_baths"."source_type" in ('natural_flow', 'circulated', 'heated', 'diluted', 'none')),
	CONSTRAINT "accommodation_baths_currency_check" CHECK ("accommodation_baths"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "accommodation_baths" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accommodation_bedrooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"unit_id" uuid NOT NULL,
	"name" jsonb
);
--> statement-breakpoint
ALTER TABLE "accommodation_bedrooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accommodation_beds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"bedroom_id" uuid NOT NULL,
	"bed_type" text,
	"count" integer,
	CONSTRAINT "accommodation_beds_bed_type_check" CHECK ("accommodation_beds"."bed_type" in ('single', 'semi_double', 'double', 'queen', 'king', 'bunk', 'futon', 'sofa_bed'))
);
--> statement-breakpoint
ALTER TABLE "accommodation_beds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accommodation_booking_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"label" text,
	"url" text NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accommodation_booking_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accommodation_cautions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"kind" text,
	"note" jsonb
);
--> statement-breakpoint
ALTER TABLE "accommodation_cautions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accommodation_internet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"has_wifi" boolean,
	"measured_mbps" numeric,
	"has_desk" boolean,
	"note" jsonb
);
--> statement-breakpoint
ALTER TABLE "accommodation_internet" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accommodation_licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"kind" text,
	"number" text,
	CONSTRAINT "accommodation_licenses_kind_check" CHECK ("accommodation_licenses"."kind" in ('ryokan_business', 'minpaku', 'special_zone_minpaku', 'simple_lodging'))
);
--> statement-breakpoint
ALTER TABLE "accommodation_licenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accommodation_meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"meal" text,
	"place" text,
	"served_from" time,
	"served_to" time,
	"allergy_ok" boolean,
	"self_cook" boolean,
	"note" jsonb,
	CONSTRAINT "accommodation_meals_meal_check" CHECK ("accommodation_meals"."meal" in ('breakfast', 'dinner')),
	CONSTRAINT "accommodation_meals_place_check" CHECK ("accommodation_meals"."place" in ('dining_room', 'room', 'private_room', 'outdoor', 'kitchen'))
);
--> statement-breakpoint
ALTER TABLE "accommodation_meals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accommodation_parkings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"place" text,
	"spaces" integer,
	"max_height_m" numeric,
	"amount" numeric,
	"currency" text,
	"note" jsonb,
	CONSTRAINT "accommodation_parkings_place_check" CHECK ("accommodation_parkings"."place" in ('on_site', 'nearby', 'none')),
	CONSTRAINT "accommodation_parkings_currency_check" CHECK ("accommodation_parkings"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "accommodation_parkings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accommodation_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"unit_id" uuid,
	"amount" numeric NOT NULL,
	"amount_max" numeric,
	"currency" text NOT NULL,
	"guests" integer,
	"meals" text,
	"valid_from" date,
	"valid_to" date,
	"tax_included" boolean,
	"bath_tax_included" boolean,
	"lodging_tax_included" boolean,
	"cleaning_fee_included" boolean,
	"booking_link_id" uuid,
	CONSTRAINT "accommodation_prices_meals_check" CHECK ("accommodation_prices"."meals" in ('none', 'breakfast', 'dinner', 'both')),
	CONSTRAINT "accommodation_prices_currency_check" CHECK ("accommodation_prices"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "accommodation_prices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accommodation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"quiet_from" time,
	"quiet_to" time,
	"bbq_until" time,
	"min_nights" integer,
	"smoking" text,
	"parties_allowed" boolean,
	"fireworks_allowed" boolean,
	"garbage" jsonb,
	"note" jsonb,
	CONSTRAINT "accommodation_rules_smoking_check" CHECK ("accommodation_rules"."smoking" in ('none', 'designated', 'allowed'))
);
--> statement-breakpoint
ALTER TABLE "accommodation_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accommodation_surroundings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"neighbor_distance_m" integer,
	"sightlines" jsonb,
	"noise_sources" jsonb,
	"view" jsonb,
	"elevation_m" numeric
);
--> statement-breakpoint
ALTER TABLE "accommodation_surroundings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accommodation_texts" (
	"dest_id" uuid NOT NULL,
	"lang" text NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	"address" text,
	CONSTRAINT "accommodation_texts_dest_id_lang_pk" PRIMARY KEY("dest_id","lang"),
	CONSTRAINT "accommodation_texts_lang_check" CHECK ("accommodation_texts"."lang" ~ '^[a-z]{2}$')
);
--> statement-breakpoint
ALTER TABLE "accommodation_texts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accommodation_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"name" jsonb,
	"capacity" integer,
	"area_sqm" numeric,
	"tatami" numeric,
	"style" text,
	"view" jsonb,
	CONSTRAINT "accommodation_units_style_check" CHECK ("accommodation_units"."style" in ('japanese', 'western', 'japanese_western'))
);
--> statement-breakpoint
ALTER TABLE "accommodation_units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accommodations" (
	"dest_id" uuid PRIMARY KEY NOT NULL,
	"operator_id" uuid,
	"kind" text,
	"region_id" text,
	"prefecture" text,
	"municipality" text,
	"district" text,
	"lat" double precision,
	"lng" double precision,
	"geo_precision" text,
	"check_in" time,
	"check_out" time,
	"official_url" text,
	CONSTRAINT "accommodations_kind_check" CHECK ("accommodations"."kind" in ('hotel', 'ryokan', 'private_rental', 'minshuku', 'pension', 'glamping', 'campsite')),
	CONSTRAINT "accommodations_geo_precision_check" CHECK ("accommodations"."geo_precision" in ('exact', 'street', 'district', 'municipality'))
);
--> statement-breakpoint
ALTER TABLE "accommodations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "building_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"how_to_get" jsonb,
	"has_parking" boolean,
	"parking_capacity" integer,
	"parking_note" jsonb
);
--> statement-breakpoint
ALTER TABLE "building_access" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "building_cautions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"kind" text,
	"note" jsonb
);
--> statement-breakpoint
ALTER TABLE "building_cautions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "building_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"name" jsonb,
	"start_date" date,
	"end_date" date,
	"season" jsonb,
	"note" jsonb
);
--> statement-breakpoint
ALTER TABLE "building_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "building_fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"label" jsonb,
	"amount" numeric NOT NULL,
	"amount_max" numeric,
	"currency" text NOT NULL,
	"note" jsonb,
	CONSTRAINT "building_fees_currency_check" CHECK ("building_fees"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "building_fees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "building_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"open_time" time,
	"close_time" time,
	"closed_days" jsonb,
	"note" jsonb
);
--> statement-breakpoint
ALTER TABLE "building_hours" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "building_texts" (
	"dest_id" uuid NOT NULL,
	"lang" text NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	"address" text,
	CONSTRAINT "building_texts_dest_id_lang_pk" PRIMARY KEY("dest_id","lang"),
	CONSTRAINT "building_texts_lang_check" CHECK ("building_texts"."lang" ~ '^[a-z]{2}$')
);
--> statement-breakpoint
ALTER TABLE "building_texts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "buildings" (
	"dest_id" uuid PRIMARY KEY NOT NULL,
	"operator_id" uuid,
	"kind" text,
	"region_id" text,
	"prefecture" text,
	"municipality" text,
	"district" text,
	"lat" double precision,
	"lng" double precision,
	"geo_precision" text,
	"official_url" text,
	CONSTRAINT "buildings_kind_check" CHECK ("buildings"."kind" in ('museum', 'shrine', 'temple', 'castle', 'observatory', 'historic_building')),
	CONSTRAINT "buildings_geo_precision_check" CHECK ("buildings"."geo_precision" in ('exact', 'street', 'district', 'municipality'))
);
--> statement-breakpoint
ALTER TABLE "buildings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "dest_categories" (
	"dest_id" uuid NOT NULL,
	"category_id" text NOT NULL,
	CONSTRAINT "dest_categories_dest_id_category_id_pk" PRIMARY KEY("dest_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "dest_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "dest_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid,
	"ref" text,
	"collector_key_id" uuid,
	"payload" jsonb NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dest_imports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "dest_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"storage_key" text NOT NULL,
	"license" text,
	"credit" text,
	"source_page_url" text,
	"original_url" text,
	"subject" text,
	"subject_ref" uuid,
	"alt" jsonb,
	CONSTRAINT "dest_photos_subject_check" CHECK ("dest_photos"."subject" in ('exterior', 'room', 'bath', 'view', 'food', 'activity', 'landscape', 'other'))
);
--> statement-breakpoint
ALTER TABLE "dest_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "destinations" (
	"dest_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"core_type" text NOT NULL,
	"slug" text NOT NULL,
	"ref" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "destinations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "destinations_ref_unique" UNIQUE("ref"),
	CONSTRAINT "destinations_core_type_check" CHECK ("destinations"."core_type" in ('accommodation', 'experience', 'nature', 'village', 'building', 'hotspring')),
	CONSTRAINT "destinations_slug_check" CHECK ("destinations"."slug" ~ '^[a-z0-9-]{3,60}$')
);
--> statement-breakpoint
ALTER TABLE "destinations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "publications" (
	"dest_id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"approved_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publications_status_check" CHECK ("publications"."status" in ('draft', 'published'))
);
--> statement-breakpoint
ALTER TABLE "publications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"name" jsonb NOT NULL,
	"icon" text DEFAULT 'tag' NOT NULL,
	"sort" integer
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "regions" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"name" jsonb NOT NULL,
	"municipality_code" text,
	"sort" integer,
	CONSTRAINT "regions_id_check" CHECK ("regions"."id" ~ '^[a-z0-9-]{1,40}$')
);
--> statement-breakpoint
ALTER TABLE "regions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "experience_booking_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"label" text,
	"url" text NOT NULL,
	"is_official" boolean
);
--> statement-breakpoint
ALTER TABLE "experience_booking_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "experience_cautions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"kind" text,
	"note" jsonb
);
--> statement-breakpoint
ALTER TABLE "experience_cautions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "experience_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"name" jsonb,
	"description" jsonb,
	"duration_minutes" integer,
	"min_people" integer,
	"max_people" integer,
	"min_age" integer,
	"languages" text[]
);
--> statement-breakpoint
ALTER TABLE "experience_courses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "experience_inclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"kind" text,
	"item" jsonb,
	CONSTRAINT "experience_inclusions_kind_check" CHECK ("experience_inclusions"."kind" in ('included', 'excluded', 'bring'))
);
--> statement-breakpoint
ALTER TABLE "experience_inclusions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "experience_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"kind" text,
	"lat" double precision,
	"lng" double precision,
	"geo_precision" text,
	"address" jsonb,
	CONSTRAINT "experience_locations_kind_check" CHECK ("experience_locations"."kind" in ('meeting', 'activity')),
	CONSTRAINT "experience_locations_geo_precision_check" CHECK ("experience_locations"."geo_precision" in ('exact', 'street', 'district', 'municipality'))
);
--> statement-breakpoint
ALTER TABLE "experience_locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "experience_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"course_id" uuid,
	"unit" text,
	"audience" text,
	"amount" numeric NOT NULL,
	"amount_max" numeric,
	"currency" text NOT NULL,
	"note" jsonb,
	CONSTRAINT "experience_prices_unit_check" CHECK ("experience_prices"."unit" in ('per_person', 'per_group', 'per_time')),
	CONSTRAINT "experience_prices_audience_check" CHECK ("experience_prices"."audience" in ('all', 'adult', 'child')),
	CONSTRAINT "experience_prices_currency_check" CHECK ("experience_prices"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "experience_prices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "experience_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"start_month" integer,
	"end_month" integer,
	"weekdays" integer[],
	"start_time" time,
	"end_time" time,
	"rain_policy" jsonb
);
--> statement-breakpoint
ALTER TABLE "experience_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "experience_texts" (
	"dest_id" uuid NOT NULL,
	"lang" text NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	"address" text,
	CONSTRAINT "experience_texts_dest_id_lang_pk" PRIMARY KEY("dest_id","lang"),
	CONSTRAINT "experience_texts_lang_check" CHECK ("experience_texts"."lang" ~ '^[a-z]{2}$')
);
--> statement-breakpoint
ALTER TABLE "experience_texts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "experiences" (
	"dest_id" uuid PRIMARY KEY NOT NULL,
	"operator_id" uuid,
	"kind" text,
	"region_id" text,
	"duration_minutes" integer,
	"reservation_required" boolean,
	"official_url" text,
	CONSTRAINT "experiences_kind_check" CHECK ("experiences"."kind" in ('tour', 'workshop', 'tasting', 'activity', 'facility_use', 'event'))
);
--> statement-breakpoint
ALTER TABLE "experiences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hotspring_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"nearest_station" text,
	"parking" boolean,
	"parking_capacity" integer,
	"note" jsonb
);
--> statement-breakpoint
ALTER TABLE "hotspring_access" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hotspring_amenities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"towel" boolean,
	"rest_area" boolean,
	"meal" boolean,
	"note" jsonb
);
--> statement-breakpoint
ALTER TABLE "hotspring_amenities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hotspring_baths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"bath_type" text,
	"spring_handling" text,
	"spring_quality" text,
	"note" jsonb,
	CONSTRAINT "hotspring_baths_bath_type_check" CHECK ("hotspring_baths"."bath_type" in ('indoor', 'open_air', 'private', 'other')),
	CONSTRAINT "hotspring_baths_spring_handling_check" CHECK ("hotspring_baths"."spring_handling" in ('free_flowing', 'circulated', 'heated', 'diluted', 'other'))
);
--> statement-breakpoint
ALTER TABLE "hotspring_baths" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hotspring_cautions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"kind" text,
	"note" jsonb
);
--> statement-breakpoint
ALTER TABLE "hotspring_cautions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hotspring_fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"fee_kind" text,
	"amount" numeric NOT NULL,
	"amount_max" numeric,
	"currency" text NOT NULL,
	"note" jsonb,
	CONSTRAINT "hotspring_fees_fee_kind_check" CHECK ("hotspring_fees"."fee_kind" in ('adult', 'child', 'private', 'other')),
	CONSTRAINT "hotspring_fees_currency_check" CHECK ("hotspring_fees"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "hotspring_fees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hotspring_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"opens_at" time,
	"closes_at" time,
	"closed_days" jsonb,
	"note" jsonb
);
--> statement-breakpoint
ALTER TABLE "hotspring_hours" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hotspring_texts" (
	"dest_id" uuid NOT NULL,
	"lang" text NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	"address" text,
	CONSTRAINT "hotspring_texts_dest_id_lang_pk" PRIMARY KEY("dest_id","lang"),
	CONSTRAINT "hotspring_texts_lang_check" CHECK ("hotspring_texts"."lang" ~ '^[a-z]{2}$')
);
--> statement-breakpoint
ALTER TABLE "hotspring_texts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hotsprings" (
	"dest_id" uuid PRIMARY KEY NOT NULL,
	"operator_id" uuid,
	"kind" text,
	"region_id" text,
	"prefecture" text,
	"municipality" text,
	"district" text,
	"lat" double precision,
	"lng" double precision,
	"geo_precision" text,
	"official_url" text,
	CONSTRAINT "hotsprings_kind_check" CHECK ("hotsprings"."kind" in ('day_use', 'public_bath', 'foot_bath')),
	CONSTRAINT "hotsprings_geo_precision_check" CHECK ("hotsprings"."geo_precision" in ('exact', 'street', 'district', 'municipality'))
);
--> statement-breakpoint
ALTER TABLE "hotsprings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nature_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"has_parking" boolean,
	"parking_note" jsonb,
	"nearest_station" text,
	"walk_minutes" integer
);
--> statement-breakpoint
ALTER TABLE "nature_access" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nature_cautions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"kind" text,
	"note" jsonb
);
--> statement-breakpoint
ALTER TABLE "nature_cautions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nature_hours_fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"open_time" time,
	"close_time" time,
	"closed_note" jsonb,
	"amount" numeric,
	"amount_max" numeric,
	"currency" text,
	CONSTRAINT "nature_hours_fees_currency_check" CHECK ("nature_hours_fees"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "nature_hours_fees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nature_restrictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"kind" text,
	"note" jsonb,
	"date_from" date,
	"date_to" date,
	CONSTRAINT "nature_restrictions_kind_check" CHECK ("nature_restrictions"."kind" in ('closure', 'volcanic_gas', 'other'))
);
--> statement-breakpoint
ALTER TABLE "nature_restrictions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nature_seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"subject" jsonb,
	"month_from" integer,
	"month_to" integer,
	CONSTRAINT "nature_seasons_month_from_check" CHECK ("nature_seasons"."month_from" between 1 and 12),
	CONSTRAINT "nature_seasons_month_to_check" CHECK ("nature_seasons"."month_to" between 1 and 12)
);
--> statement-breakpoint
ALTER TABLE "nature_seasons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nature_texts" (
	"dest_id" uuid NOT NULL,
	"lang" text NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	"address" text,
	CONSTRAINT "nature_texts_dest_id_lang_pk" PRIMARY KEY("dest_id","lang"),
	CONSTRAINT "nature_texts_lang_check" CHECK ("nature_texts"."lang" ~ '^[a-z]{2}$')
);
--> statement-breakpoint
ALTER TABLE "nature_texts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "nature_trails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"name" jsonb,
	"distance_km" numeric,
	"elevation_gain_m" integer,
	"difficulty" text,
	"duration_minutes" integer,
	CONSTRAINT "nature_trails_difficulty_check" CHECK ("nature_trails"."difficulty" in ('easy', 'moderate', 'hard'))
);
--> statement-breakpoint
ALTER TABLE "nature_trails" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "natures" (
	"dest_id" uuid PRIMARY KEY NOT NULL,
	"kind" text,
	"region_id" text,
	"prefecture" text,
	"municipality" text,
	"district" text,
	"lat" double precision,
	"lng" double precision,
	"geo_precision" text,
	"protection" text,
	CONSTRAINT "natures_kind_check" CHECK ("natures"."kind" in ('coast', 'mountain', 'lake', 'highland', 'gorge', 'waterfall', 'forest', 'volcano')),
	CONSTRAINT "natures_protection_check" CHECK ("natures"."protection" in ('national_park', 'quasi_national_park', 'prefectural_park', 'geopark', 'none')),
	CONSTRAINT "natures_geo_precision_check" CHECK ("natures"."geo_precision" in ('exact', 'street', 'district', 'municipality'))
);
--> statement-breakpoint
ALTER TABLE "natures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "collector_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "collector_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "collector_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "operator_memberships" (
	"user_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operator_memberships_user_id_operator_id_pk" PRIMARY KEY("user_id","operator_id")
);
--> statement-breakpoint
ALTER TABLE "operator_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "operators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text,
	"contact_email" text,
	"contact_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operators_kind_check" CHECK ("operators"."kind" in ('company', 'individual', 'municipality', 'organization'))
);
--> statement-breakpoint
ALTER TABLE "operators" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_saves" (
	"user_id" uuid NOT NULL,
	"dest_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_saves_user_id_dest_id_pk" PRIMARY KEY("user_id","dest_id")
);
--> statement-breakpoint
ALTER TABLE "user_saves" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"locale" text,
	"currency" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tour_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tour_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "tour_shares_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "tour_shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tour_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tour_id" uuid NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"day" integer,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "tour_stops" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tours" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "village_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"kind" text,
	"note" jsonb,
	CONSTRAINT "village_access_kind_check" CHECK ("village_access"."kind" in ('station', 'bus', 'car', 'parking', 'walk', 'other'))
);
--> statement-breakpoint
ALTER TABLE "village_access" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "village_cautions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"kind" text,
	"note" jsonb
);
--> statement-breakpoint
ALTER TABLE "village_cautions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "village_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"name" jsonb,
	"season" text,
	"note" jsonb
);
--> statement-breakpoint
ALTER TABLE "village_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "village_shop_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"opens_at" time,
	"closes_at" time,
	"note" jsonb
);
--> statement-breakpoint
ALTER TABLE "village_shop_hours" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "village_texts" (
	"dest_id" uuid NOT NULL,
	"lang" text NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	"address" text,
	CONSTRAINT "village_texts_dest_id_lang_pk" PRIMARY KEY("dest_id","lang"),
	CONSTRAINT "village_texts_lang_check" CHECK ("village_texts"."lang" ~ '^[a-z]{2}$')
);
--> statement-breakpoint
ALTER TABLE "village_texts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "village_walks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dest_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"area" jsonb,
	"duration_min" integer
);
--> statement-breakpoint
ALTER TABLE "village_walks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "villages" (
	"dest_id" uuid PRIMARY KEY NOT NULL,
	"kind" text,
	"region_id" text,
	"prefecture" text,
	"municipality" text,
	"district" text,
	"lat" double precision,
	"lng" double precision,
	"geo_precision" text,
	CONSTRAINT "villages_kind_check" CHECK ("villages"."kind" in ('onsen_town', 'post_town', 'fishing_village', 'temple_town', 'castle_town')),
	CONSTRAINT "villages_geo_precision_check" CHECK ("villages"."geo_precision" in ('exact', 'street', 'district', 'municipality'))
);
--> statement-breakpoint
ALTER TABLE "villages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accommodation_access" ADD CONSTRAINT "accommodation_access_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_amenities" ADD CONSTRAINT "accommodation_amenities_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_amenities" ADD CONSTRAINT "accommodation_amenities_unit_id_accommodation_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."accommodation_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_baths" ADD CONSTRAINT "accommodation_baths_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_baths" ADD CONSTRAINT "accommodation_baths_unit_id_accommodation_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."accommodation_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_bedrooms" ADD CONSTRAINT "accommodation_bedrooms_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_bedrooms" ADD CONSTRAINT "accommodation_bedrooms_unit_id_accommodation_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."accommodation_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_beds" ADD CONSTRAINT "accommodation_beds_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_beds" ADD CONSTRAINT "accommodation_beds_bedroom_id_accommodation_bedrooms_id_fk" FOREIGN KEY ("bedroom_id") REFERENCES "public"."accommodation_bedrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_booking_links" ADD CONSTRAINT "accommodation_booking_links_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_cautions" ADD CONSTRAINT "accommodation_cautions_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_internet" ADD CONSTRAINT "accommodation_internet_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_licenses" ADD CONSTRAINT "accommodation_licenses_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_meals" ADD CONSTRAINT "accommodation_meals_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_parkings" ADD CONSTRAINT "accommodation_parkings_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_prices" ADD CONSTRAINT "accommodation_prices_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_prices" ADD CONSTRAINT "accommodation_prices_unit_id_accommodation_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."accommodation_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_prices" ADD CONSTRAINT "accommodation_prices_booking_link_id_accommodation_booking_links_id_fk" FOREIGN KEY ("booking_link_id") REFERENCES "public"."accommodation_booking_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_rules" ADD CONSTRAINT "accommodation_rules_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_surroundings" ADD CONSTRAINT "accommodation_surroundings_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_texts" ADD CONSTRAINT "accommodation_texts_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_units" ADD CONSTRAINT "accommodation_units_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_access" ADD CONSTRAINT "building_access_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_cautions" ADD CONSTRAINT "building_cautions_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_events" ADD CONSTRAINT "building_events_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_fees" ADD CONSTRAINT "building_fees_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_hours" ADD CONSTRAINT "building_hours_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_texts" ADD CONSTRAINT "building_texts_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dest_categories" ADD CONSTRAINT "dest_categories_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dest_categories" ADD CONSTRAINT "dest_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dest_imports" ADD CONSTRAINT "dest_imports_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dest_imports" ADD CONSTRAINT "dest_imports_collector_key_id_collector_keys_id_fk" FOREIGN KEY ("collector_key_id") REFERENCES "public"."collector_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dest_photos" ADD CONSTRAINT "dest_photos_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_booking_links" ADD CONSTRAINT "experience_booking_links_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_cautions" ADD CONSTRAINT "experience_cautions_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_courses" ADD CONSTRAINT "experience_courses_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_inclusions" ADD CONSTRAINT "experience_inclusions_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_locations" ADD CONSTRAINT "experience_locations_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_prices" ADD CONSTRAINT "experience_prices_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_prices" ADD CONSTRAINT "experience_prices_course_id_experience_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."experience_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_schedules" ADD CONSTRAINT "experience_schedules_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_texts" ADD CONSTRAINT "experience_texts_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotspring_access" ADD CONSTRAINT "hotspring_access_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotspring_amenities" ADD CONSTRAINT "hotspring_amenities_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotspring_baths" ADD CONSTRAINT "hotspring_baths_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotspring_cautions" ADD CONSTRAINT "hotspring_cautions_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotspring_fees" ADD CONSTRAINT "hotspring_fees_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotspring_hours" ADD CONSTRAINT "hotspring_hours_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotspring_texts" ADD CONSTRAINT "hotspring_texts_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotsprings" ADD CONSTRAINT "hotsprings_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotsprings" ADD CONSTRAINT "hotsprings_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotsprings" ADD CONSTRAINT "hotsprings_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nature_access" ADD CONSTRAINT "nature_access_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nature_cautions" ADD CONSTRAINT "nature_cautions_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nature_hours_fees" ADD CONSTRAINT "nature_hours_fees_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nature_restrictions" ADD CONSTRAINT "nature_restrictions_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nature_seasons" ADD CONSTRAINT "nature_seasons_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nature_texts" ADD CONSTRAINT "nature_texts_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nature_trails" ADD CONSTRAINT "nature_trails_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "natures" ADD CONSTRAINT "natures_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "natures" ADD CONSTRAINT "natures_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collector_keys" ADD CONSTRAINT "collector_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_memberships" ADD CONSTRAINT "operator_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_memberships" ADD CONSTRAINT "operator_memberships_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saves" ADD CONSTRAINT "user_saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saves" ADD CONSTRAINT "user_saves_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_shares" ADD CONSTRAINT "tour_shares_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_stops" ADD CONSTRAINT "tour_stops_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_stops" ADD CONSTRAINT "tour_stops_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tours" ADD CONSTRAINT "tours_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "village_access" ADD CONSTRAINT "village_access_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "village_cautions" ADD CONSTRAINT "village_cautions_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "village_events" ADD CONSTRAINT "village_events_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "village_shop_hours" ADD CONSTRAINT "village_shop_hours_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "village_texts" ADD CONSTRAINT "village_texts_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "village_walks" ADD CONSTRAINT "village_walks_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "villages" ADD CONSTRAINT "villages_dest_id_destinations_dest_id_fk" FOREIGN KEY ("dest_id") REFERENCES "public"."destinations"("dest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "villages" ADD CONSTRAINT "villages_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accommodation_access_dest_id_idx" ON "accommodation_access" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "accommodation_amenities_dest_id_idx" ON "accommodation_amenities" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "accommodation_baths_dest_id_idx" ON "accommodation_baths" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "accommodation_bedrooms_dest_id_idx" ON "accommodation_bedrooms" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "accommodation_beds_dest_id_idx" ON "accommodation_beds" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "accommodation_booking_links_dest_id_idx" ON "accommodation_booking_links" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "accommodation_cautions_dest_id_idx" ON "accommodation_cautions" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "accommodation_internet_dest_id_idx" ON "accommodation_internet" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "accommodation_licenses_dest_id_idx" ON "accommodation_licenses" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "accommodation_meals_dest_id_idx" ON "accommodation_meals" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "accommodation_parkings_dest_id_idx" ON "accommodation_parkings" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "accommodation_prices_dest_id_idx" ON "accommodation_prices" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "accommodation_rules_dest_id_idx" ON "accommodation_rules" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "accommodation_surroundings_dest_id_idx" ON "accommodation_surroundings" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "accommodation_units_dest_id_idx" ON "accommodation_units" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "building_access_dest_id_idx" ON "building_access" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "building_cautions_dest_id_idx" ON "building_cautions" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "building_events_dest_id_idx" ON "building_events" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "building_fees_dest_id_idx" ON "building_fees" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "building_hours_dest_id_idx" ON "building_hours" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "dest_imports_dest_id_idx" ON "dest_imports" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "dest_photos_dest_id_idx" ON "dest_photos" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "experience_booking_links_dest_id_idx" ON "experience_booking_links" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "experience_cautions_dest_id_idx" ON "experience_cautions" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "experience_courses_dest_id_idx" ON "experience_courses" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "experience_inclusions_dest_id_idx" ON "experience_inclusions" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "experience_locations_dest_id_idx" ON "experience_locations" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "experience_prices_dest_id_idx" ON "experience_prices" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "experience_schedules_dest_id_idx" ON "experience_schedules" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "hotspring_access_dest_id_idx" ON "hotspring_access" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "hotspring_amenities_dest_id_idx" ON "hotspring_amenities" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "hotspring_baths_dest_id_idx" ON "hotspring_baths" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "hotspring_cautions_dest_id_idx" ON "hotspring_cautions" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "hotspring_fees_dest_id_idx" ON "hotspring_fees" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "hotspring_hours_dest_id_idx" ON "hotspring_hours" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "nature_access_dest_id_idx" ON "nature_access" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "nature_cautions_dest_id_idx" ON "nature_cautions" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "nature_hours_fees_dest_id_idx" ON "nature_hours_fees" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "nature_restrictions_dest_id_idx" ON "nature_restrictions" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "nature_seasons_dest_id_idx" ON "nature_seasons" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "nature_trails_dest_id_idx" ON "nature_trails" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "tour_shares_tour_id_idx" ON "tour_shares" USING btree ("tour_id");--> statement-breakpoint
CREATE INDEX "tour_stops_tour_id_idx" ON "tour_stops" USING btree ("tour_id");--> statement-breakpoint
CREATE INDEX "tours_owner_id_idx" ON "tours" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "village_access_dest_id_idx" ON "village_access" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "village_cautions_dest_id_idx" ON "village_cautions" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "village_events_dest_id_idx" ON "village_events" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "village_shop_hours_dest_id_idx" ON "village_shop_hours" USING btree ("dest_id");--> statement-breakpoint
CREATE INDEX "village_walks_dest_id_idx" ON "village_walks" USING btree ("dest_id");--> statement-breakpoint
CREATE VIEW "public"."dest_cards" WITH (security_invoker = true) AS (
with texts as (
  select dest_id, lang, name, summary from public.accommodation_texts
  union all select dest_id, lang, name, summary from public.experience_texts
  union all select dest_id, lang, name, summary from public.nature_texts
  union all select dest_id, lang, name, summary from public.village_texts
  union all select dest_id, lang, name, summary from public.building_texts
  union all select dest_id, lang, name, summary from public.hotspring_texts
),
places as (
  select dest_id, region_id, lat, lng from public.accommodations
  union all select dest_id, region_id, lat, lng from public.natures
  union all select dest_id, region_id, lat, lng from public.villages
  union all select dest_id, region_id, lat, lng from public.buildings
  union all select dest_id, region_id, lat, lng from public.hotsprings
  union all
  select e.dest_id, e.region_id, l.lat, l.lng
  from public.experiences e
  left join lateral (
    select x.lat, x.lng from public.experience_locations x where x.dest_id = e.dest_id order by x.sort, x.id limit 1
  ) l on true
)
select
  d.dest_id, d.core_type, d.slug, d.is_demo, d.created_at, pub.published_at,
  pl.region_id, pl.lat, pl.lng,
  t.name, t.summary,
  coalesce(c.category_ids, '{}'::text[]) as category_ids,
  coalesce(ph.photos, '[]'::jsonb) as photos
from public.destinations d
join public.publications pub on pub.dest_id = d.dest_id and pub.status = 'published'
left join places pl on pl.dest_id = d.dest_id
left join lateral (
  select
    jsonb_object_agg(x.lang, x.name) as name,
    jsonb_object_agg(x.lang, x.summary) filter (where x.summary is not null) as summary
  from texts x where x.dest_id = d.dest_id
) t on true
left join lateral (
  select array_agg(x.category_id order by x.category_id) as category_ids
  from public.dest_categories x where x.dest_id = d.dest_id
) c on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object('storage_key', x.storage_key, 'license', x.license, 'credit', x.credit, 'alt', x.alt)
    order by x.sort, x.id
  ) as photos
  from public.dest_photos x where x.dest_id = d.dest_id
) ph on true
);--> statement-breakpoint
CREATE POLICY "public read" ON "accommodation_access" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("accommodation_access"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "accommodation_amenities" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("accommodation_amenities"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "accommodation_baths" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("accommodation_baths"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "accommodation_bedrooms" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("accommodation_bedrooms"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "accommodation_beds" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("accommodation_beds"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "accommodation_booking_links" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("accommodation_booking_links"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "accommodation_cautions" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("accommodation_cautions"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "accommodation_internet" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("accommodation_internet"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "accommodation_licenses" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("accommodation_licenses"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "accommodation_meals" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("accommodation_meals"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "accommodation_parkings" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("accommodation_parkings"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "accommodation_prices" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("accommodation_prices"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "accommodation_rules" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("accommodation_rules"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "accommodation_surroundings" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("accommodation_surroundings"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "accommodation_texts" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("accommodation_texts"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "accommodation_units" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("accommodation_units"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "accommodations" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("accommodations"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "building_access" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("building_access"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "building_cautions" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("building_cautions"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "building_events" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("building_events"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "building_fees" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("building_fees"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "building_hours" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("building_hours"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "building_texts" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("building_texts"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "buildings" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("buildings"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "dest_categories" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("dest_categories"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "dest_photos" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("dest_photos"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "destinations" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("destinations"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "publications" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("publications"."status" = 'published');--> statement-breakpoint
CREATE POLICY "anyone read" ON "categories" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "anyone read" ON "regions" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "public read" ON "experience_booking_links" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("experience_booking_links"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "experience_cautions" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("experience_cautions"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "experience_courses" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("experience_courses"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "experience_inclusions" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("experience_inclusions"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "experience_locations" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("experience_locations"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "experience_prices" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("experience_prices"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "experience_schedules" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("experience_schedules"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "experience_texts" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("experience_texts"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "experiences" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("experiences"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "hotspring_access" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("hotspring_access"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "hotspring_amenities" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("hotspring_amenities"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "hotspring_baths" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("hotspring_baths"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "hotspring_cautions" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("hotspring_cautions"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "hotspring_fees" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("hotspring_fees"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "hotspring_hours" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("hotspring_hours"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "hotspring_texts" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("hotspring_texts"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "hotsprings" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("hotsprings"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "nature_access" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("nature_access"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "nature_cautions" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("nature_cautions"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "nature_hours_fees" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("nature_hours_fees"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "nature_restrictions" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("nature_restrictions"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "nature_seasons" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("nature_seasons"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "nature_texts" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("nature_texts"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "nature_trails" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("nature_trails"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "natures" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("natures"."dest_id"));--> statement-breakpoint
CREATE POLICY "self read" ON "operator_memberships" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("operator_memberships"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "self all" ON "user_saves" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_saves"."user_id" = (select auth.uid())) WITH CHECK ("user_saves"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "self read" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("users"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "self update" ON "users" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("users"."id" = (select auth.uid())) WITH CHECK ("users"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "owner all" ON "tour_shares" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from "tours" where "tours"."id" = "tour_shares"."tour_id" and "tours"."owner_id" = (select auth.uid()))) WITH CHECK (exists (select 1 from "tours" where "tours"."id" = "tour_shares"."tour_id" and "tours"."owner_id" = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "owner all" ON "tour_stops" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from "tours" where "tours"."id" = "tour_stops"."tour_id" and "tours"."owner_id" = (select auth.uid()))) WITH CHECK (exists (select 1 from "tours" where "tours"."id" = "tour_stops"."tour_id" and "tours"."owner_id" = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "owner all" ON "tours" AS PERMISSIVE FOR ALL TO "authenticated" USING ("tours"."owner_id" = (select auth.uid())) WITH CHECK ("tours"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "public read" ON "tours" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("tours"."is_public");--> statement-breakpoint
CREATE POLICY "public read" ON "village_access" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("village_access"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "village_cautions" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("village_cautions"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "village_events" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("village_events"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "village_shop_hours" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("village_shop_hours"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "village_texts" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("village_texts"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "village_walks" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("village_walks"."dest_id"));--> statement-breakpoint
CREATE POLICY "public read" ON "villages" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (public.is_published("villages"."dest_id"));