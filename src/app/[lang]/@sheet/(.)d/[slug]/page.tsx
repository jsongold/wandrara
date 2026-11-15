// トップから詳細へ移るときは、トップを残したまま下からシートで出す（intercepting route）。
// 共有リンク・再読み込みでは app/[lang]/d/[slug]/page.tsx が全画面で出る。
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DestDetail } from "@/components/DestDetail";
import { DetailSheet } from "@/components/DetailSheet";
import { getDestDetail } from "@/lib/detail";
import { isLocale } from "@/lib/i18n/locale";

export default function DestSheet(props: PageProps<"/[lang]/d/[slug]">) {
  return (
    <DetailSheet>
      <Suspense fallback={<SheetSkeleton />}>
        <Dest params={props.params} />
      </Suspense>
    </DetailSheet>
  );
}

async function Dest({ params }: Pick<PageProps<"/[lang]/d/[slug]">, "params">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const dest = await getDestDetail(slug, lang);
  if (!dest) notFound();
  return <DestDetail dest={dest} variant="sheet" />;
}

function SheetSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="h-[320px] animate-pulse bg-[#d9d6ce]" />
      <div className="mx-5 h-6 w-2/3 animate-pulse rounded bg-[#e2dfd6]" />
      <div className="mx-5 h-4 w-1/3 animate-pulse rounded bg-[#e2dfd6]" />
    </div>
  );
}
