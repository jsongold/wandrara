import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { SuggestPlan, type PlanCard } from "@/components/SuggestPlan";
import { getAreaSheetData } from "@/lib/data";
import { isLocale } from "@/lib/i18n/locale";
import { planCards } from "@/lib/plan-candidates";
import { SAVE_DATA_COOKIE, saveDataOfRequest } from "@/lib/save-data";
import { inArea, matchedKeywords, orderBySuggest, parseSuggestArea, parseSuggestTraits } from "@/lib/suggest";
import { keywordOf } from "@/lib/suggest-vocab";

export default function PlanPage(props: PageProps<"/[lang]/plan">) {
  return (
    <Suspense fallback={<main className="h-[100dvh] bg-[#0f0f0e]" />}>
      <Plan params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

// 提案ページ：?area= で絞り（これまでどおり）、?t= のこだわり（キーワード）に合う数の多い順に宿と体験を並べる。こだわりは絞り込みではない
async function Plan({ params, searchParams }: Pick<PageProps<"/[lang]/plan">, "params" | "searchParams">) {
  const { lang: locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const picked = parseSuggestTraits(sp.t);
  const area = parseSuggestArea(sp.area);
  const [all, sheet, h, jar] = await Promise.all([planCards(locale), getAreaSheetData(locale), headers(), cookies()]);
  // 通信量を抑える利用者（Save-Data ヘッダか本人が選んだ cookie）。Home と同じく最初の描画から写真の画質を下げる
  const saveData = saveDataOfRequest(h.get("save-data"), jar.get(SAVE_DATA_COOKIE)?.value);
  const { byRegion } = sheet.traits;
  const matched = new Map(all.map((c) => [c.key, matchedKeywords(c, picked, byRegion)]));
  const cards: PlanCard[] = orderBySuggest(all.filter((c) => inArea(c, area)), -1, picked, (c) => matched.get(c.key) ?? []).map((c) => ({
    ...c,
    reason: (matched.get(c.key) ?? []).map((k) => keywordOf(k)?.label ?? k),
  }));
  return <SuggestPlan locale={locale} picked={picked} area={area} cards={cards} saveData={saveData} />;
}
