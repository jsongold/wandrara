"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { areaSheetLoader, IDLE_AREA_SHEET } from "@/lib/area-sheet-client";
import { messages } from "@/lib/i18n/messages";
import { countMatching, hasData, MAX_KEYWORDS, suggestPlanHref, type PlanItem } from "@/lib/suggest";
import type { PresetView } from "@/lib/suggest-presets";
import { tripQuery } from "@/lib/trip";
import { currentTrip } from "@/lib/use-trip";
import { BIG_CATEGORIES, KEYWORDS, keywordOf, PRESETS, type Preset } from "@/lib/suggest-vocab";
import type { Locale } from "@/lib/types";
import { AreaMap } from "./AreaMap";
import { Icon } from "./icons";

export const GLASS: CSSProperties = {
  background: "rgba(18,18,16,0.46)",
  backdropFilter: "blur(16px) saturate(1.2)",
  WebkitBackdropFilter: "blur(16px) saturate(1.2)",
  border: "1px solid rgba(255,255,255,0.14)",
};

type View = "rec" | "kw" | "list" | "map";
const VIEWS: View[] = ["rec", "kw", "list", "map"];
const VIEW_ICON: Record<View, string> = { rec: "sparkle", kw: "filter", list: "menu", map: "map" };
const next = (v: View) => VIEWS[(VIEWS.indexOf(v) + 1) % VIEWS.length];

// 提案シートの件数に使う候補の一覧と、おすすめの表紙・代表の場所（/api/plan-index）。ページの間 1 度だけ取る
type PlanIndex = { items: PlanItem[]; presets: Record<string, PresetView> };
let indexCache: Promise<PlanIndex> | null = null;
function loadIndex(locale: Locale): Promise<PlanIndex> {
  indexCache ??= fetch(`/api/plan-index?lang=${locale}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .catch((e) => {
      indexCache = null;
      throw e;
    });
  return indexCache;
}

// 画面の下に常に出る提案の入力バー。押すと提案シートが開く。
// シートは 1 画面に 1 つ（おすすめ → こだわり → エリアのリスト → エリアの地図）で、下のバーの左のボタンで回す。
// こだわりは 大分類 > 分類 > キーワード、エリアは エリア > 地区。行を押すとその下に開く。「提案」で提案ページ（/[lang]/plan?t=…&area=…）へ
// trigger：下のバーを差し替える（提案ルームでは選択肢のポップアップを先に出し、そこから条件のシートを開く）。open はシートを開く、preload は先読み
type Trigger = (open: () => void, preload: () => void) => ReactNode;
export function SuggestBar({ locale, initial = [], initialArea = "all", trigger }: { locale: Locale; initial?: string[]; initialArea?: string; trigger?: Trigger }) {
  const m = messages(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("rec");
  const [draft, setDraft] = useState<string[]>(initial);
  const [area, setArea] = useState(initialArea);
  const [openBig, setOpenBig] = useState<string | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  // 開いているエリアの行。undefined はまだ触っていない（選んでいるエリアの行を開いたことにする）
  const [openAreaState, setOpenArea] = useState<string | null | undefined>(undefined);
  const [index, setIndex] = useState<PlanIndex | null>(null);
  const items = index?.items ?? null;
  const sheet = useSyncExternalStore(areaSheetLoader.subscribe, () => areaSheetLoader.get(locale), () => IDLE_AREA_SHEET);
  const data = sheet.status === "ready" ? sheet.data : null;
  const byRegion = data?.traits.byRegion;
  const load = () => {
    areaSheetLoader.load(locale);
    loadIndex(locale).then(setIndex, () => setIndex(null));
  };

  const labelById = useMemo(() => new Map((data?.areas ?? []).flatMap((g) => [[g.id, g.label] as const, ...g.subs.map((x) => [x.id, x.label] as const)])), [data]);
  const parentOf = useMemo(() => Object.fromEntries((data?.areas ?? []).flatMap((g) => [[g.id, null], ...g.subs.map((s) => [s.id, g.id])])) as Record<string, string | null>, [data]);
  const count = (keywords: string[], a = area) => (items && byRegion ? countMatching(items, keywords, a, byRegion) : null);
  const areaCount = (a: string) => count([], a);

  const groupOf = (a: string) => (a === "all" ? null : (data?.areas.find((x) => x.id === a || x.subs.some((s) => s.id === a))?.id ?? null));
  const openArea = openAreaState === undefined ? groupOf(area) : openAreaState;

  function openSheet() {
    load();
    setDraft(initial);
    setArea(initialArea);
    setView("rec");
    setOpenArea(undefined);
    setOpen(true);
  }
  const toggle = (id: string) => setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length < MAX_KEYWORDS ? [...d, id] : d));
  const presetOn = (p: Preset) => p.keywords.every((k) => draft.includes(k));
  const togglePreset = (p: Preset) =>
    setDraft((d) => {
      if (presetOn(p)) return d.filter((k) => !p.keywords.includes(k));
      const next = [...new Set([...d, ...p.keywords])];
      return next.length <= MAX_KEYWORDS ? next : d;
    });
  const pickArea = (id: string) => setArea((a) => (a === id ? "all" : id));
  function onSuggest() {
    setOpen(false);
    router.push(suggestPlanHref(locale, draft, area, tripQuery(currentTrip())));
  }

  const total = count(draft);
  const viewName = view === "rec" || view === "kw" ? m.home.suggestViews[view] : m.home.suggestArea;

  return (
    <>
      {trigger ? (
        trigger(openSheet, load)
      ) : (
        <button
          type="button"
          onClick={openSheet}
          onPointerDown={load}
          onFocus={load}
          className="absolute inset-x-3 bottom-[18px] z-[6] flex h-[52px] cursor-pointer items-center gap-2.5 rounded-[18px] px-4 text-left text-[15px] text-white/90"
          style={GLASS}
        >
          <Icon name="sparkle" size={18} className="flex-none" />
          <span className="min-w-0 flex-auto truncate">{m.home.suggestBar}</span>
        </button>
      )}

      {open && (
        <>
          <button type="button" aria-label={m.home.closeSheet(m.home.suggestSheet)} onClick={() => setOpen(false)} className="absolute inset-0 z-[19] cursor-pointer border-0 bg-black/40" />
          <section role="dialog" aria-label={m.home.suggestSheet} className="absolute inset-x-0 bottom-0 top-[8%] z-20 flex flex-col rounded-t-3xl bg-[#1b1b19] text-white">
            {/* 上：今の画面の名前と閉じる */}
            <div className="flex items-center justify-between px-4 pb-1.5 pt-4">
              <h2 className="m-0 flex items-baseline gap-2 text-[15px] font-bold">
                {viewName}
                {(view === "list" || view === "map") && <small className="text-[12px] font-normal text-white/60">{m.home.suggestViews[view]}</small>}
              </h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={m.common.close} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-white/10 text-white">
                <Icon name="close" size={16} />
              </button>
            </div>

            {/* 選んだもの（どの画面でも出す。押すと外す） */}
            {(draft.length > 0 || area !== "all") && (
              <div className="flex flex-wrap gap-1.5 border-b border-white/10 px-4 pb-2.5">
                {area !== "all" && (
                  <button type="button" onClick={() => setArea("all")} aria-label={m.home.suggestRemove(labelById.get(area) ?? area)} className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-[#f4f1ea] bg-transparent pl-2 pr-1.5 text-[12.5px] font-bold text-[#f4f1ea]">
                    <Icon name="pin" size={12} />
                    {labelById.get(area) ?? area}
                    <Icon name="close" size={12} />
                  </button>
                )}
                {draft.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(id)}
                    aria-label={m.home.suggestRemove(keywordOf(id)?.label ?? id)}
                    className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border bg-transparent pl-2.5 pr-1.5 text-[12.5px] font-bold ${hasData(id) ? "border-[#f4f1ea] text-[#f4f1ea]" : "border-dashed border-white/30 text-white/45"}`}
                  >
                    {keywordOf(id)?.label ?? id}
                    <Icon name="close" size={12} />
                  </button>
                ))}
              </div>
            )}

            <div className={`min-h-0 flex-auto overflow-y-auto px-4 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${view === "map" ? "flex flex-col" : ""}`}>
              {view === "rec" && <PresetList m={m} on={presetOn} toggle={togglePreset} count={count} views={index?.presets ?? null} />}
              {view === "kw" && (
                <KeywordTree draft={draft} toggle={toggle} openBig={openBig} openSub={openSub} setOpenBig={(b) => { setOpenBig(b); setOpenSub(null); }} setOpenSub={setOpenSub} count={count} />
              )}
              {view === "list" && (
                <div className="flex flex-col">
                  <Row label={m.home.allAreasChip} n={areaCount("all")} pressed={area === "all"} onClick={() => setArea("all")} />
                  {(data?.areas ?? [])
                    .map((g, i) => ({ g, i, n: areaCount(g.id) ?? 0 }))
                    .sort((a, b) => b.n - a.n || a.i - b.i)
                    .map(({ g, n }) => {
                      const here = area === g.id || g.subs.some((s) => s.id === area);
                      return (
                        <div key={g.id}>
                          <Row label={g.label} n={n || null} dim={!n} expanded={openArea === g.id} badge={here ? (area === g.id ? m.home.areaWhole("") : labelById.get(area)) : undefined} onClick={() => setOpenArea(openArea === g.id ? null : g.id)} />
                          {openArea === g.id && (
                            <div className="flex flex-wrap gap-1.5 border-b border-white/10 py-2.5 pl-4">
                              {[{ id: g.id, label: m.home.areaWhole(g.label) }, ...g.subs].map((s) => (
                                <Kw key={s.id} label={s.label} n={areaCount(s.id)} pressed={area === s.id} dim={!areaCount(s.id)} onClick={() => pickArea(s.id)} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  {sheet.status !== "ready" && <p role="status" className="m-0 py-3 text-[13px] text-white/70">{m.common.loading}</p>}
                </div>
              )}
              {view === "map" && data && (
                <AreaMap current={area} labelOf={(id) => labelById.get(id) ?? id} parentOf={parentOf} onSelect={pickArea} />
              )}
              {view === "map" && !data && <p role="status" className="m-0 py-3 text-[13px] text-white/70">{m.common.loading}</p>}
            </div>

            {/* 下のバー：切り替え ／ 提案 */}
            <div className="flex flex-none items-center gap-2 border-t border-white/10 px-3 pb-4 pt-2.5">
              <button
                type="button"
                onClick={() => setView(next(view))}
                aria-label={m.home.suggestCycle(m.home.suggestViews[next(view)])}
                className="flex h-[50px] w-[58px] flex-none cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[14px] border border-white/30 bg-transparent text-white"
              >
                <Icon name={VIEW_ICON[next(view)]} size={18} />
                <span className="text-[10px] leading-none text-white/70">{m.home.suggestViews[next(view)]}</span>
              </button>
              <button type="button" onClick={onSuggest} className="h-[50px] flex-auto cursor-pointer rounded-[14px] border-0 bg-[#f4f1ea] text-[15px] font-bold text-[#141413]">
                {m.home.suggestApply}
                {total !== null && <small className="ml-1.5 text-[12px] font-normal">{m.home.suggestCount(total)}</small>}
              </button>
            </div>
          </section>
        </>
      )}
    </>
  );
}

type M = ReturnType<typeof messages>;

// おすすめ：左に一言（明朝）・説明（代表の場所とキーワード）・件数、右に代表の場所の写真。枠線と背景は付けない。
// 並びは旬が先、残りは当てはまる件数の多い順（数えられないものは後ろ）
function PresetList({ m, on, toggle, count, views }: { m: M; on: (p: Preset) => boolean; toggle: (p: Preset) => void; count: (k: string[]) => number | null; views: Record<string, PresetView> | null }) {
  const rows = PRESETS.map((p, i) => {
    const live = p.keywords.filter((k) => hasData(k));
    return { p, i, n: live.length ? count(live) : null, live: live.length > 0 };
  }).sort((a, b) => (b.p.season ? 1 : 0) - (a.p.season ? 1 : 0) || Number(b.live) - Number(a.live) || (b.n ?? 0) - (a.n ?? 0) || a.i - b.i);
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {rows.map(({ p, n, live }) => {
        const pressed = on(p);
        const view = views?.[p.id];
        const desc = [view?.places.length ? m.home.suggestPlaces(view.places.join(m.common.listSep)) : "", p.keywords.map((k) => keywordOf(k)?.label ?? k).join(m.common.listSep)].filter(Boolean).join("");
        return (
          <li key={p.id}>
            <button type="button" aria-pressed={pressed} onClick={() => toggle(p)} className="flex w-full cursor-pointer items-stretch gap-3 border-0 bg-transparent p-0 text-left">
              <span className="flex min-w-0 flex-auto flex-col gap-[5px] py-3">
                <span className={`font-[family-name:var(--font-phrase)] text-[17px] font-bold leading-[1.4] [text-wrap:balance] ${pressed ? "text-[#f4f1ea]" : "text-white"}`}>{p.text}</span>
                <span className="text-[12px] leading-[1.55] text-white/70">{desc}</span>
                <span className="flex items-center gap-2 text-[12px] text-white/90">
                  <span aria-hidden="true" className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-[1.5px] ${pressed ? "border-[#f4f1ea] bg-[#f4f1ea] text-[#141413]" : "border-white/50 text-transparent"}`}>
                    <Icon name="check" size={11} />
                  </span>
                  {live && n !== null ? m.home.suggestCount(n) : m.home.suggestNotYet}
                  {p.season && <span className="text-[#f4f1ea]">{p.season}</span>}
                </span>
              </span>
              {view?.cover ? (
                <Image src={view.cover} alt="" width={118} height={118} sizes="118px" className="my-2.5 h-[118px] w-[118px] flex-none rounded-xl object-cover" />
              ) : (
                <span aria-hidden="true" className="my-2.5 h-[118px] w-[118px] flex-none rounded-xl bg-white/5" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// こだわり：大分類 > 分類 > キーワード。行を押すとその下に開く
function KeywordTree({ draft, toggle, openBig, openSub, setOpenBig, setOpenSub, count }: {
  draft: string[]; toggle: (id: string) => void; openBig: string | null; openSub: string | null; setOpenBig: (b: string | null) => void; setOpenSub: (s: string | null) => void; count: (k: string[]) => number | null;
}) {
  const live = (f: (k: (typeof KEYWORDS)[number]) => boolean) => KEYWORDS.some((k) => f(k) && hasData(k.id));
  const picked = (f: (k: (typeof KEYWORDS)[number]) => boolean) => draft.filter((id) => { const k = keywordOf(id); return k ? f(k) : false; }).length;
  // 大分類は、値を持つキーワードがあるものを先に（候補表の順）
  const bigs = [...BIG_CATEGORIES].sort((a, b) => Number(live((k) => k.big === b)) - Number(live((k) => k.big === a)));
  return (
    <div className="flex flex-col">
      {bigs.map((b) => {
        const subs = [...new Set(KEYWORDS.filter((k) => k.big === b).map((k) => k.sub))];
        return (
          <div key={b}>
            <Row label={b} dim={!live((k) => k.big === b)} expanded={openBig === b} count={picked((k) => k.big === b)} onClick={() => setOpenBig(openBig === b ? null : b)} />
            {openBig === b &&
              subs.map((x) => (
                <div key={x}>
                  <Row label={x} sub dim={!live((k) => k.big === b && k.sub === x)} expanded={openSub === x} count={picked((k) => k.big === b && k.sub === x)} onClick={() => setOpenSub(openSub === x ? null : x)} />
                  {openSub === x && (
                    <div className="flex flex-wrap gap-1.5 border-b border-white/10 py-2.5 pl-7">
                      {KEYWORDS.filter((k) => k.big === b && k.sub === x).map((k) =>
                        hasData(k.id) ? (
                          <Kw key={k.id} label={k.label} n={count([k.id])} pressed={draft.includes(k.id)} onClick={() => toggle(k.id)} />
                        ) : (
                          <span key={k.id} className="inline-flex h-[34px] items-center rounded-full border border-dashed border-white/15 px-3 text-[13px] text-white/30">{k.label}</span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, n, dim, expanded, pressed, sub, count, badge, onClick }: {
  label: string; n?: number | null; dim?: boolean; expanded?: boolean; pressed?: boolean; sub?: boolean; count?: number; badge?: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-pressed={pressed}
      className={`flex w-full cursor-pointer items-center justify-between gap-2 border-0 border-b border-white/10 bg-transparent text-left ${sub ? "min-h-10 pl-4 text-[13.5px]" : "min-h-11 px-1 text-[14px]"} ${dim ? "text-white/40" : expanded || pressed ? "font-bold text-[#f4f1ea]" : "text-white/90"}`}
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        {label}
        {n != null && <span className="text-[11px] font-normal tabular-nums text-white/45">{n}</span>}
        {!!count && <span className="rounded-full bg-[#f4f1ea] px-1.5 text-[11px] font-bold text-[#141413]">{count}</span>}
        {badge && <span className="rounded-full bg-[#f4f1ea] px-1.5 text-[11px] font-bold text-[#141413]">{badge}</span>}
      </span>
      {expanded !== undefined && <Icon name="chevron-down" size={14} className={`flex-none text-white/50 ${expanded ? "rotate-180" : ""}`} />}
      {pressed && <Icon name="check" size={14} className="flex-none" />}
    </button>
  );
}

function Kw({ label, n, pressed, dim, onClick }: { label: string; n: number | null; pressed: boolean; dim?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-full border bg-transparent px-3 text-[13px] ${pressed ? "border-[#f4f1ea] font-bold text-[#f4f1ea]" : dim ? "border-white/15 text-white/40" : "border-white/35 text-white/85"}`}
    >
      {label}
      {n !== null && <span className="text-[11px] tabular-nums text-white/50">{n}</span>}
    </button>
  );
}
