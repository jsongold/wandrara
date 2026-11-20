import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProposalRoom } from "@/components/ProposalRoom";
import { getAreaSheetData } from "@/lib/data";
import { messages } from "@/lib/i18n/messages";
import { isLocale } from "@/lib/i18n/locale";
import { planCards } from "@/lib/plan-candidates";
import { getDestTraits } from "@/lib/dest-traits-source";
import { roomData } from "@/lib/plan-room";
import { SAVE_DATA_COOKIE, saveDataOfRequest } from "@/lib/save-data";
import { inArea, parseSuggestArea, parseSuggestTraits, proposalName } from "@/lib/suggest";
import { keywordOf } from "@/lib/suggest-vocab";

export default function PlanPage(props: PageProps<"/[lang]/plan">) {
  return (
    <Suspense fallback={<main className="h-[100dvh] bg-[#0f0f0e]" />}>
      <Plan params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

// 提案ルーム：?area= で候補を絞り、?t= のこだわりを条件にして、ステージングのチャットで提案を続ける（どれを出すかは src/lib/propose）
async function Plan({ params, searchParams }: Pick<PageProps<"/[lang]/plan">, "params" | "searchParams">) {
  const { lang: locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const picked = parseSuggestTraits(sp.t);
  const area = parseSuggestArea(sp.area);
  const [all, sheet, destTraits, h, jar] = await Promise.all([planCards(locale), getAreaSheetData(locale), getDestTraits(), headers(), cookies()]);
  // 通信量を抑える利用者（Save-Data ヘッダか本人が選んだ cookie）。Home と同じく最初の描画から写真の画質を下げる
  const saveData = saveDataOfRequest(h.get("save-data"), jar.get(SAVE_DATA_COOKIE)?.value);
  const cards = all.filter((c) => inArea(c, area));
  // ルームの名前：エリアの名前（地区なら地区）と、選んだこだわりの名前
  const m = messages(locale);
  const areaLabel = sheet.areas.flatMap((g) => [g, ...g.subs]).find((x) => x.id === area)?.label ?? null;
  const name = proposalName(areaLabel, picked.map((k) => keywordOf(k)?.label ?? k), { all: m.plan.allAreas, sep: m.plan.nameSep, more: m.plan.nameMore });
  return <ProposalRoom locale={locale} name={name} picked={picked} area={area} data={roomData(cards, picked, sheet.traits, sheet.areas, destTraits)} saveData={saveData} />;
}
