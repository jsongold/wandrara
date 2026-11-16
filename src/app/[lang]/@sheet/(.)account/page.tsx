// トップのユーザーアイコンから開くと、トップを残したまま下からシートで出す（intercepting route）。
// 再読み込み・直接開いたときは app/[lang]/account/page.tsx が全画面で出る。
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccountView } from "@/components/AccountView";
import { DetailSheet } from "@/components/DetailSheet";
import { isLocale } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";

export default async function AccountSheet(props: PageProps<"/[lang]/account">) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  return (
    <DetailSheet label={messages(lang).account.title}>
      <Suspense fallback={<div className="h-full bg-[#faf9f6]" />}>
        <AccountView lang={lang} variant="sheet" />
      </Suspense>
    </DetailSheet>
  );
}
