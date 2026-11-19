CREATE TABLE "languages" (
	"tag" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "languages_tag_check" CHECK ("languages"."tag" ~ '^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$')
);
--> statement-breakpoint
ALTER TABLE "languages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- 権限：このプロジェクトでは新しい表に権限が自動で付かないので明示する（行の可否は RLS の anyone read）
grant select on public.languages to anon, authenticated;--> statement-breakpoint
grant all on public.languages to service_role;--> statement-breakpoint
-- 最初の言語。外部キーを張る前に、すでに使われている言語も入れる（形の違う値があれば languages_tag_check でここで止まる）
insert into public.languages (tag) values ('ja'), ('en');--> statement-breakpoint
insert into public.languages (tag)
select lang from public.accommodation_texts union select lang from public.building_texts
union select lang from public.experience_texts union select lang from public.hotspring_texts
union select lang from public.nature_texts union select lang from public.village_texts
union select locale from public.users where locale is not null
on conflict (tag) do nothing;--> statement-breakpoint
ALTER TABLE "accommodation_texts" DROP CONSTRAINT "accommodation_texts_lang_check";--> statement-breakpoint
ALTER TABLE "building_texts" DROP CONSTRAINT "building_texts_lang_check";--> statement-breakpoint
ALTER TABLE "experience_texts" DROP CONSTRAINT "experience_texts_lang_check";--> statement-breakpoint
ALTER TABLE "hotspring_texts" DROP CONSTRAINT "hotspring_texts_lang_check";--> statement-breakpoint
ALTER TABLE "nature_texts" DROP CONSTRAINT "nature_texts_lang_check";--> statement-breakpoint
ALTER TABLE "village_texts" DROP CONSTRAINT "village_texts_lang_check";--> statement-breakpoint
ALTER TABLE "accommodation_texts" ADD CONSTRAINT "accommodation_texts_lang_languages_tag_fk" FOREIGN KEY ("lang") REFERENCES "public"."languages"("tag") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_texts" ADD CONSTRAINT "building_texts_lang_languages_tag_fk" FOREIGN KEY ("lang") REFERENCES "public"."languages"("tag") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_texts" ADD CONSTRAINT "experience_texts_lang_languages_tag_fk" FOREIGN KEY ("lang") REFERENCES "public"."languages"("tag") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotspring_texts" ADD CONSTRAINT "hotspring_texts_lang_languages_tag_fk" FOREIGN KEY ("lang") REFERENCES "public"."languages"("tag") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nature_texts" ADD CONSTRAINT "nature_texts_lang_languages_tag_fk" FOREIGN KEY ("lang") REFERENCES "public"."languages"("tag") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_locale_languages_tag_fk" FOREIGN KEY ("locale") REFERENCES "public"."languages"("tag") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "village_texts" ADD CONSTRAINT "village_texts_lang_languages_tag_fk" FOREIGN KEY ("lang") REFERENCES "public"."languages"("tag") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "anyone read" ON "languages" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);