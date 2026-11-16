// トップのユーザーアイコンから開くと、トップを残したまま下からシートで出す（intercepting route）。
// 再読み込み・直接開いたときは app/[lang]/login/page.tsx が全画面で出る。
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { DetailSheet } from "@/components/DetailSheet";
import { LoginPanel } from "@/components/LoginPanel";
import { getCurrentUser, localizedNextPath } from "@/lib/auth/next";
import { isLocale } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";

export default async function LoginSheet(props: PageProps<"/[lang]/login">) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  return (
    <DetailSheet label={messages(lang).login.title}>
      <Suspense fallback={<div className="h-full bg-[#24231f]" />}>
        <Login lang={lang} searchParams={props.searchParams} />
      </Suspense>
    </DetailSheet>
  );
}

async function Login({ lang, searchParams }: { lang: Locale; searchParams: PageProps<"/[lang]/login">["searchParams"] }) {
  const raw = (await searchParams).next;
  const next = localizedNextPath(Array.isArray(raw) ? raw[0] : raw, lang);
  if (await getCurrentUser()) redirect(next);
  return <LoginPanel locale={lang} next={next} variant="sheet" />;
}
