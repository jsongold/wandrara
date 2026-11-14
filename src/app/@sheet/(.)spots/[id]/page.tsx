// トップから詳細へ移るときは、トップを残したまま下からシートで出す（intercepting route）。
// 共有リンク・再読み込みでは app/spots/[id]/page.tsx が全画面で出る。
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DetailSheet } from "@/components/DetailSheet";
import { SpotDetail } from "@/components/SpotDetail";
import { getSpotDetail } from "@/lib/data";

export default function SpotSheet(props: PageProps<"/spots/[id]">) {
  return (
    <DetailSheet>
      <Suspense fallback={<SheetSkeleton />}>
        <Spot params={props.params} />
      </Suspense>
    </DetailSheet>
  );
}

async function Spot({ params }: Pick<PageProps<"/spots/[id]">, "params">) {
  const { id } = await params;
  const spot = await getSpotDetail(id, "ja");
  if (!spot) notFound();
  return <SpotDetail spot={spot} variant="sheet" />;
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
