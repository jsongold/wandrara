"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { messages } from "@/lib/i18n/messages";
import { buildItinerary } from "@/lib/itinerary";
import type { PlanCard, RoomData } from "@/lib/plan-room";
import {
  allReacted,
  applyChoice,
  applyReaction,
  applyRound,
  defaultStrategies,
  GOAL_V1,
  goalStatus,
  initialState,
  nextRound,
  reactionCause,
  type Cause,
  type Choice,
  type FeatureId,
  type ProposeState,
  type Strategies,
} from "@/lib/propose";
import type { Reaction } from "@/lib/reactions";
import { bookable, finalDraft, needsBooking, type ShareItem } from "@/lib/share-plan";
import type { Locale } from "@/lib/types";
import { SaveDataHint } from "@/lib/use-save-data";
import { Icon } from "./icons";
import { PhotoCarousel } from "./PhotoCarousel";
import { ReactionButtons } from "./ReactionButtons";
import { GLASS, SuggestBar } from "./SuggestBar";

// 吹き出しの並び。リアクションは吹き出しにしない（カードの上だけに出す）
type Msg =
  | { t: "user"; text: string }
  | { t: "bot"; text: string; ids?: string[] }
  | { t: "choices"; choices: Choice[]; picked: FeatureId | null }
  | { t: "plan"; stay: string; activities: string[] };

type Room = { state: ProposeState; thread: Msg[]; latest: string[]; choices: Choice[]; done: boolean; algorithm: string | null };

type Props = { locale: Locale; name: string; picked: string[]; area: string; data: RoomData };

// 提案ルーム。ステージング（自分だけ）で提案が続き、Fix で共有ルーム（Fix した旅程が一番上）を開く。
// 提案の中身は src/lib/propose（機械的に選ぶ。画面は結果を並べるだけ）
export function ProposalRoom({ saveData, ...props }: Props & { saveData: boolean }) {
  return (
    <SaveDataHint value={saveData}>
      {/* 条件が変わったら作り直す */}
      <RoomBody key={`${props.area}|${props.picked.join(",")}`} {...props} />
    </SaveDataHint>
  );
}

// data-home：詳細シートが開いている間、裏を操作できなくする目印（DetailSheet が inert にする）
function RoomBody({ locale, name, picked, area, data }: Props) {
  const m = messages(locale);
  const t = m.plan;
  const cardById = useMemo(() => new Map(data.cards.map((c) => [c.destId, c])), [data.cards]);
  const labelOf = (f: FeatureId) => data.labels[f] ?? f;
  const strategies = useMemo(() => defaultStrategies(t.lead, (f) => data.labels[f] ?? f), [t.lead, data.labels]);
  const choiceText = (f: FeatureId) => t.choiceLabel(f.slice(0, f.indexOf(":")), labelOf(f));

  // 開いたら最初の回を出す（条件の吹き出しのあとに、最初の候補）
  const [room, setRoom] = useState<Room>(() => {
    const empty: Room = { state: initialState(data.conditions), thread: [{ t: "user", text: name }], latest: [], choices: [], done: false, algorithm: null };
    return advanceRoom(empty, empty.state, { type: "start" }, data, strategies);
  });
  const [view, setView] = useState<"staging" | "share">("staging");
  const [popup, setPopup] = useState(false);

  const advance = (r: Room, state: ProposeState, cause: Cause, pre: Msg[] = [], withChoices = false) => advanceRoom(r, state, cause, data, strategies, pre, withChoices);

  // ゴール（宿 1 ＋ 過ごし方）の埋まり具合。Fix はプランがそろったら
  const goal = goalStatus(room.state, data.candidates);

  function onNext() {
    if (room.done || goal.complete) return;
    setRoom((r) => advance(r, r.state, { type: "next" }));
  }

  function onReact(id: string, reaction: Reaction) {
    setRoom((r) => {
      const state = applyReaction(r.state, id, reaction);
      // 今の回すべてにリアクションしたら、次の候補と選択肢を出す（前の回の候補へのリアクションでは出さない）
      if (!r.done && r.latest.includes(id) && allReacted(state, r.latest)) {
        return advance(r, state, reactionCause(state, r.latest, (x) => cardById.get(x)?.title ?? x), [], true);
      }
      return { ...r, state };
    });
  }

  // 選択肢を選ぶ。msgIndex：メッセージの選択肢から選んだときの、そのメッセージ（選んだものを残す）
  function onChoose(feature: FeatureId, msgIndex: number | null) {
    setPopup(false);
    setRoom((r) => {
      const thread = r.thread.map((x, i) => (i === msgIndex && x.t === "choices" ? { ...x, picked: feature } : x));
      return advance({ ...r, thread }, applyChoice(r.state, feature), { type: "choice", feature }, [{ t: "user", text: choiceText(feature) }]);
    });
  }

  const reactions = room.state.reactions;
  const planIds = goal.stay ? [goal.stay, ...goal.activities] : goal.activities;
  const canFix = goal.complete;

  if (view === "share") {
    // 旅程は、そろったプランの宿と過ごし方だけから作る
    const planReactions = Object.fromEntries(planIds.map((id) => [id, reactions[id] ?? "good"]));
    return <ShareRoom locale={locale} name={name} data={data} reactions={planReactions} onBack={() => setView("staging")} />;
  }

  return (
    <div data-home className="relative mx-auto flex h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden bg-[#0f0f0e] text-white" data-algorithm={room.algorithm ?? undefined}>
      <header className="flex flex-none items-center gap-1 border-b border-white/[0.08] py-2 pl-1 pr-2">
        <Link href={`/${locale}`} aria-label={m.common.back} className="flex h-11 w-11 flex-none items-center justify-center text-white">
          <Icon name="back" size={20} />
        </Link>
        <div className="min-w-0 flex-auto">
          <h1 className="m-0 truncate font-[family-name:var(--font-phrase)] text-[19px] font-bold leading-snug">{name}</h1>
          <p className="m-0 flex items-center gap-1 text-[12px] text-white/60">
            <Icon name="lock" size={12} />
            {t.staging}　{t.progress(goal.stay ? 1 : 0, goal.activities.length, GOAL_V1.activities)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => canFix && setView("share")}
          aria-label={t.fixLabel}
          aria-disabled={!canFix}
          className={`flex h-12 min-w-[52px] flex-none cursor-pointer flex-col items-center justify-center gap-px border-0 bg-transparent ${canFix ? "text-[#f4f1ea]" : "text-white/30"}`}
        >
          <Icon name="flag" size={20} />
          <span className="text-[10px] font-bold">{t.fix}</span>
        </button>
      </header>

      {/* 新しいものが下。下に寄せて積む */}
      <div className="flex flex-auto flex-col-reverse overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ol className="m-0 flex list-none flex-col gap-[18px] px-0 pb-[96px] pt-4">
          {room.thread.map((msg, i) => (
            <li key={i} className="flex flex-col gap-2.5">
              {msg.t === "user" && <p className="m-0 ml-[72px] mr-4 self-end rounded-[18px_18px_4px_18px] bg-[#f4f1ea] px-3.5 py-2 text-[14px] leading-normal text-[#141413]">{msg.text}</p>}
              {(msg.t === "bot" || msg.t === "choices") && <BotLine text={msg.t === "choices" ? t.choicesAsk : msg.text} />}
              {msg.t === "bot" && msg.ids && (
                <div className="flex snap-x snap-mandatory scroll-pl-[52px] gap-3 overflow-x-auto pl-[52px] pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {msg.ids.map((id) => {
                    const card = cardById.get(id);
                    return card ? <RoomCard key={id} locale={locale} card={card} value={reactions[id]} onPick={(r) => onReact(id, r)} /> : null;
                  })}
                </div>
              )}
              {msg.t === "plan" && <PlanMessage locale={locale} name={name} msg={msg} cardById={cardById} onFix={() => setView("share")} />}
              {msg.t === "choices" && (
                <ChoiceChips choices={msg.choices} picked={msg.picked} label={choiceText} onPick={(f) => onChoose(f, i)} ariaLabel={t.choicesAsk} indent />
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* 下：入力バー（押すと選択肢）と次へ。条件のシートは選択肢のポップアップから開く */}
      <SuggestBar
        locale={locale}
        initial={picked}
        initialArea={area}
        trigger={(openSheet, preload) => (
          <>
            {popup && (
              <>
                <button type="button" aria-label={m.common.close} onClick={() => setPopup(false)} className="absolute inset-0 z-[7] cursor-pointer border-0 bg-black/45" />
                <section role="dialog" aria-label={t.popupTitle} className="absolute inset-x-0 bottom-0 z-[8] flex flex-col gap-3 rounded-t-3xl bg-[#1b1b19] px-4 pb-[92px] pt-4">
                  <div className="flex items-center justify-between">
                    <h2 className="m-0 text-[15px] font-bold">{t.popupTitle}</h2>
                    <button type="button" aria-label={m.common.close} onClick={() => setPopup(false)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-white/10 text-white">
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                  {room.choices.length ? (
                    <ChoiceChips choices={room.choices} picked={null} label={choiceText} onPick={(f) => onChoose(f, null)} ariaLabel={t.popupTitle} />
                  ) : (
                    <p className="m-0 text-[13px] text-white/60">{t.noChoices}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPopup(false);
                      openSheet();
                    }}
                    onPointerDown={preload}
                    className="flex min-h-11 cursor-pointer items-center gap-2 self-start border-0 bg-transparent px-0 text-[14px] text-white/80"
                  >
                    <Icon name="filter" size={16} />
                    {t.editConditions}
                  </button>
                </section>
              </>
            )}
            <div className="absolute inset-x-3 bottom-[18px] z-[9] flex gap-2">
              <button
                type="button"
                onClick={() => setPopup((p) => !p)}
                aria-expanded={popup}
                className="flex h-[52px] min-w-0 flex-auto cursor-pointer items-center gap-2.5 rounded-[18px] px-4 text-left text-[15px] text-white/90"
                style={GLASS}
              >
                <Icon name="sparkle" size={18} className="flex-none" />
                <span className="min-w-0 flex-auto truncate">{m.home.suggestBar}</span>
              </button>
              <button
                type="button"
                onClick={onNext}
                aria-label={t.next}
                aria-disabled={room.done || goal.complete}
                className={`flex h-[52px] w-[52px] flex-none cursor-pointer items-center justify-center rounded-[18px] border-0 ${room.done || goal.complete ? "bg-white/[0.12] text-white/40" : "bg-[#f4f1ea] text-[#141413]"}`}
              >
                <Icon name="arrow" size={22} />
              </button>
            </div>
          </>
        )}
      />
    </div>
  );
}

// 次の回を出す（純関数）。withChoices：選択肢のメッセージも続けて出す（全部にリアクションしたとき）
function advanceRoom(r: Room, state: ProposeState, cause: Cause, data: RoomData, strategies: Strategies, pre: Msg[] = [], withChoices = false): Room {
  const res = nextRound(state, cause, data.candidates, strategies);
  const thread: Msg[] = [...r.thread, ...pre, { t: "bot", text: res.lead, ids: res.done || !res.ids.length ? undefined : res.ids }];
  // ゴールがそろったら、プランを出す（候補はもう出さない）
  if (res.goal?.complete && res.goal.stay) thread.push({ t: "plan", stay: res.goal.stay, activities: res.goal.activities });
  else if (withChoices && !res.done && res.choices.length) thread.push({ t: "choices", choices: res.choices, picked: null });
  return { state: applyRound(state, res), thread, latest: res.done ? r.latest : res.ids, choices: res.choices, done: res.done, algorithm: res.algorithm };
}

// そろったプラン：宿と過ごし方を並べ、その下にグループへ送る文（アーティファクト）。Fix は控えめに
function PlanMessage({ locale, name, msg, cardById, onFix }: { locale: Locale; name: string; msg: Extract<Msg, { t: "plan" }>; cardById: Map<string, PlanCard>; onFix: () => void }) {
  const m = messages(locale);
  const rows = [msg.stay, ...msg.activities].map((id) => cardById.get(id)).filter((c): c is PlanCard => Boolean(c));
  return (
    <section aria-label={m.plan.planTitle} className="ml-[52px] mr-4 flex flex-col gap-1 rounded-[18px] bg-[#1b1b19] px-3.5 pb-3.5 pt-3">
      <h2 className="m-0 mb-1 text-[13px] font-bold text-[#f4f1ea]">{m.plan.planTitle}</h2>
      {rows.map((c) => (
        <div key={c.destId} className="flex items-center gap-3 py-1.5">
          <PhotoCarousel photos={c.photos.slice(0, 1)} label={c.title} className="h-11 w-11 flex-none rounded-[10px]" priority={false} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[14px] font-bold">{c.title}</span>
            <span className="text-[11.5px] text-white/60">
              {c.kindLabel}
              {m.common.listSep}
              {c.areaLabel}
            </span>
          </span>
        </div>
      ))}
      <ShareArtifact locale={locale} name={name} stay={cardById.get(msg.stay)} activities={msg.activities.map((id) => cardById.get(id)).filter((c): c is PlanCard => Boolean(c))} />
      <button type="button" onClick={onFix} className="mt-1 flex min-h-11 cursor-pointer items-center justify-center gap-2 border-0 bg-transparent text-[13px] text-white/70">
        <Icon name="flag" size={15} />
        {m.plan.fixThisPlan}
      </button>
    </section>
  );
}

const slugOf = (href: string) => href.slice(href.lastIndexOf("/") + 1);
type ShareState = { status: "loading" } | { status: "error" } | { status: "ready"; text: string; items: ShareItem[] };

// グループへ送る文：データカタログの詳細（料金・時間・行き方）を本文に、地図・予約・公式・WANDRARA のリンクを添える。コピーか、端末の共有で送る
function ShareArtifact({ locale, name, stay, activities }: { locale: Locale; name: string; stay: PlanCard | undefined; activities: PlanCard[] }) {
  const m = messages(locale);
  const t = m.plan;
  const [share, setShare] = useState<ShareState>({ status: "loading" });
  const [copied, setCopied] = useState<"final" | "plain" | null>(null);
  const query = new URLSearchParams({ lang: locale, title: name, ...(stay ? { stay: slugOf(stay.href) } : {}), acts: activities.map((c) => slugOf(c.href)).join(",") }).toString();
  useEffect(() => {
    let live = true;
    fetch(`/api/plan-share?${query}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { text: string; items: ShareItem[] }) => live && setShare({ status: "ready", text: j.text, items: j.items }))
      .catch(() => live && setShare({ status: "error" }));
    return () => {
      live = false;
    };
  }, [query]);

  if (share.status !== "ready") return <p className="m-0 mt-2 text-[12.5px] text-white/60">{share.status === "loading" ? t.shareLoading : t.shareFailed}</p>;
  const ready = share.items.filter(bookable).length;
  const toBook = share.items.filter(needsBooking).length;
  async function copy(text: string, which: "final" | "plain") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
    } catch {
      setCopied(null);
    }
  }
  // FinalDraft：Agent に渡す指示・埋める所・下書き
  const final = finalDraft(share.text, share.items, t.finalDraft);
  const canSend = typeof navigator !== "undefined" && "share" in navigator;
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="m-0 text-[13px] font-bold text-[#f4f1ea]">{t.shareTitle}</h3>
        <span className="text-[11.5px] text-white/60">{t.bookableCount(ready, toBook)}</span>
      </div>
      <ol className="m-0 flex list-none flex-col gap-0.5 p-0 text-[12px] text-white/70">
        {t.finalSteps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <pre className="m-0 max-h-[260px] overflow-y-auto whitespace-pre-wrap break-all rounded-[12px] bg-black/30 p-3 font-sans text-[12.5px] leading-relaxed text-white/90">{share.text}</pre>
      <div className="flex gap-2">
        <button type="button" onClick={() => copy(final, "final")} className="flex h-11 flex-auto cursor-pointer items-center justify-center gap-2 rounded-[14px] border-0 bg-[#f4f1ea] text-[14px] font-bold text-[#141413]">
          <Icon name={copied === "final" ? "check" : "copy"} size={16} />
          {copied === "final" ? t.copied : t.copyFinal}
        </button>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => copy(share.text, "plain")} className="flex min-h-11 flex-auto cursor-pointer items-center justify-center gap-2 border-0 bg-transparent text-[13px] text-white/75">
          <Icon name={copied === "plain" ? "check" : "copy"} size={15} />
          {copied === "plain" ? t.copied : t.copyPlain}
        </button>
        {canSend && (
          <button type="button" onClick={() => navigator.share({ text: share.text }).catch(() => {})} className="flex min-h-11 flex-auto cursor-pointer items-center justify-center gap-2 border-0 bg-transparent text-[13px] text-white/75">
            <Icon name="share" size={15} />
            {t.send}
          </button>
        )}
      </div>
    </div>
  );
}

function BotLine({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 pl-4 pr-12">
      <span aria-hidden="true" className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white/10 text-[#f4f1ea]">
        <Icon name="sparkle" size={15} />
      </span>
      <p className="m-0 pt-1 text-[14px] leading-relaxed text-white/90">{text}</p>
    </div>
  );
}

// 返事の中のカード：写真・合う理由・名前・種類とエリア・リアクション。背景と枠は付けない
function RoomCard({ locale, card, value, onPick }: { locale: Locale; card: PlanCard; value: Reaction | undefined; onPick: (r: Reaction) => void }) {
  const m = messages(locale);
  return (
    <div className="flex w-[210px] flex-none snap-start flex-col gap-2">
      <PhotoCarousel photos={card.photos} href={card.href} label={card.title} className="aspect-[4/3] rounded-[14px]" counterClassName="right-2 top-2" priority={false}>
        {(card.photos[0]?.isDemo ?? true) && (
          <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-[rgba(15,15,14,0.6)] px-1.5 py-0.5 text-[10px] font-semibold">{m.home.photoDemo}</span>
        )}
      </PhotoCarousel>
      <Link href={card.href} className="flex flex-col gap-0.5 text-white no-underline">
        {card.reason.length > 0 && <span className="text-[11.5px] font-bold text-[#f4f1ea]">{m.home.reasonMatch(card.reason.join(m.common.listSep))}</span>}
        <span className="text-[15px] font-bold leading-snug">{card.title}</span>
        <span className="text-[12px] text-white/60">
          {card.kindLabel}
          {m.common.listSep}
          {card.areaLabel}
        </span>
      </Link>
      <ReactionButtons locale={locale} title={card.title} value={value} onPick={onPick} className="-ml-2.5" />
    </div>
  );
}

// 選択肢（押せる丸いボタン）。picked があれば、それだけ明るく、ほかは押せない
function ChoiceChips({ choices, picked, label, onPick, ariaLabel, indent = false }: { choices: Choice[]; picked: FeatureId | null; label: (f: FeatureId) => string; onPick: (f: FeatureId) => void; ariaLabel: string; indent?: boolean }) {
  const used = picked !== null;
  return (
    <div role="group" aria-label={ariaLabel} className={`flex flex-wrap gap-2 ${indent ? "pl-[52px] pr-4" : ""}`}>
      {choices.map((c) => {
        const on = picked === c.feature;
        return (
          <button
            key={c.feature}
            type="button"
            disabled={used}
            aria-pressed={on}
            onClick={() => onPick(c.feature)}
            className={`min-h-10 cursor-pointer rounded-full border px-3.5 text-[13px] disabled:cursor-default ${
              on ? "border-[#f4f1ea] bg-[#f4f1ea] text-[#141413]" : used ? "border-white/15 bg-transparent text-white/40" : "border-white/30 bg-transparent text-white"
            }`}
          >
            {label(c.feature)}
          </button>
        );
      })}
    </div>
  );
}

// 共有ルーム：Fix した旅程が一番上。招待（リンク）は次に作る
function ShareRoom({ locale, name, data, reactions, onBack }: { locale: Locale; name: string; data: RoomData; reactions: ProposeState["reactions"]; onBack: () => void }) {
  const m = messages(locale);
  const t = m.plan;
  const cardById = new Map(data.cards.map((c) => [c.destId, c]));
  const items = buildItinerary(
    data.cards.map((c) => ({ id: c.destId, isStay: c.coreType === "accommodation" })),
    reactions,
  );
  const today = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", { dateStyle: "long" }).format(new Date());
  return (
    <div data-home className="relative mx-auto flex h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden bg-[#0f0f0e] text-white">
      <header className="flex flex-none items-center gap-1 border-b border-white/[0.08] py-2 pl-1 pr-4">
        <button type="button" onClick={onBack} aria-label={t.backToStaging} className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center border-0 bg-transparent text-white">
          <Icon name="back" size={20} />
        </button>
        <div className="min-w-0 flex-auto">
          <h1 className="m-0 truncate font-[family-name:var(--font-phrase)] text-[19px] font-bold leading-snug">{name}</h1>
          <p className="m-0 text-[12px] text-white/60">{t.shareRoom}</p>
        </div>
      </header>
      <div className="flex flex-auto flex-col gap-[18px] overflow-y-auto px-4 pb-10 pt-3.5">
        <article aria-label={t.fixedOn(today)} className="flex flex-col gap-1 rounded-[20px] bg-[#1b1b19] px-4 pb-2 pt-[18px]">
          <p className="m-0 flex items-center gap-1.5 text-[11.5px] font-bold text-[#f4f1ea]">
            <Icon name="flag" size={13} />
            {t.fixedOn(today)}
          </p>
          <h2 className="m-0 mb-2 font-[family-name:var(--font-phrase)] text-[22px] font-bold leading-snug">{t.itineraryTitle(name)}</h2>
          <ol className="m-0 flex list-none flex-col p-0">
            {items.map((it) => {
              const card = it.id ? cardById.get(it.id) : undefined;
              return (
                <li key={it.slot} className="flex items-center gap-3 border-t border-white/[0.08] py-2.5">
                  <span className="w-16 flex-none text-[12px] leading-snug text-white/60">{t.slots[it.slot]}</span>
                  {card ? (
                    <PhotoCarousel photos={card.photos.slice(0, 1)} label={card.title} className="h-11 w-11 flex-none rounded-[10px]" priority={false} />
                  ) : (
                    <span aria-hidden="true" className="h-11 w-11 flex-none rounded-[10px] border border-dashed border-white/30" />
                  )}
                  <span className="flex min-w-0 flex-auto flex-col">
                    <span className={card ? "text-[14px] font-bold leading-snug" : "text-[14px] text-white/60"}>{card?.title ?? t.undecided}</span>
                    <span className="text-[11.5px] text-white/60">
                      {card ? `${card.kindLabel}${m.common.listSep}${card.areaLabel}${it.great ? `　${t.reactions.great}` : ""}` : t.stayKind}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </article>
        <BotLine text={t.itineraryNote} />
      </div>
    </div>
  );
}
