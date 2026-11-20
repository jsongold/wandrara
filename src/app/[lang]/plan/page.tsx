import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProposalRoom } from "@/components/ProposalRoom";
import { isLocale } from "@/lib/i18n/locale";
import { loadRoom } from "@/lib/plan-room-load";
import { SAVE_DATA_COOKIE, saveDataOfRequest } from "@/lib/save-data";

export default function PlanPage(props: PageProps<"/[lang]/plan">) {
  return (
    <Suspense fallback={<main className="h-[100dvh] bg-[#0f0f0e]" />}>
      <Plan params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

// 提案ルーム：?area= で候補を絞り、?t= のこだわりと旅の目的を条件にして、ステージングのチャットで提案を続ける（どれを出すかは src/lib/propose）
async function Plan({ params, searchParams }: Pick<PageProps<"/[lang]/plan">, "params" | "searchParams">) {
  const { lang: locale } = await params;
  if (!isLocale(locale)) notFound();
  const [room, h, jar] = await Promise.all([loadRoom(locale, await searchParams), headers(), cookies()]);
  // 通信量を抑える利用者（Save-Data ヘッダか本人が選んだ cookie）。Home と同じく最初の描画から写真の画質を下げる
  const saveData = saveDataOfRequest(h.get("save-data"), jar.get(SAVE_DATA_COOKIE)?.value);
  return <ProposalRoom locale={locale} name={room.name} picked={room.picked} area={room.area} tripParams={room.tripParams} trip={room.trip} data={room.data} saveData={saveData} />;
}
