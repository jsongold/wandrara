import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SavedList } from "@/components/SavedList";
import { getCurrentUser } from "@/lib/auth/next";
import { getCatalog } from "@/lib/data";
import { isLocale, withLocale } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";
import { getSavedDests } from "@/lib/saves-server";
import { createClient } from "@/lib/supabase/server";

export default function SavedPage(props: PageProps<"/[lang]/saved">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#faf9f6]" />}>
      <Saved params={props.params} />
    </Suspense>
  );
}

async function Saved({ params }: Pick<PageProps<"/[lang]/saved">, "params">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const to = (path: string) => withLocale(lang, path);
  const m = messages(lang).saves;
  const c = messages(lang).common;
  const user = await getCurrentUser();
  if (!user) redirect(to(`/login?next=${encodeURIComponent(to("/saved"))}`));

  const items = await getSavedDests(await createClient(), await getCatalog(), lang);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-[#faf9f6] text-[#171717]">
      <div className="flex h-14 items-center gap-1 px-2">
        <Link href={to("/account")} aria-label={c.back} className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="m-0 text-base font-semibold">{m.title}</h1>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 px-4 pb-7 pt-2">
        <SavedList items={items} emptyText={m.empty} />
      </div>
    </div>
  );
}
