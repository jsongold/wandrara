// プランを、グループのチャットにそのまま貼れる文にする（純関数）。
// リンクに飛ばなくても決められるように、料金・時間・行き方を本文に入れ、Wandrara・地図・予約（Booking・Airbnb など）・公式のリンクを添える。
// 料金や行き方が無いときは推測せず「不明」と書く（宿と体験だけ。自然などは料金の行を出さない）
import type { DestDetailView } from "./detail";
import type { Locale } from "./types";

export type ShareRole = "stay" | "activity";
export type ShareLink = { label: string; url: string };
export type ShareItem = {
  role: ShareRole;
  title: string;
  kindLabel: string;
  areaLabel: string;
  summary: string | null;
  /** 料金の一行。料金を出す種類で値が無ければ null（文では「不明」） */
  price: string | null;
  /** 料金を出す種類か（宿・体験） */
  priced: boolean;
  times: string | null;
  access: string | null;
  wandraraUrl: string;
  mapUrl: string | null;
  links: ShareLink[];
};

export type ShareText = {
  heading: (title: string) => string;
  role: Record<ShareRole, string>;
  price: string;
  times: string;
  access: string;
  unknown: string;
  map: string;
  book: string;
  more: string;
  footer: string;
};

const yen = (n: number, locale: Locale) => n.toLocaleString(locale === "ja" ? "ja-JP" : "en-US");
const range = (min: number, max: number, locale: Locale) => (min === max ? yen(min, locale) : `${yen(min, locale)}〜${yen(max, locale)}`);

/** 料金の一行：一番安い〜高い ＋ 単位（「1 棟 1 泊・税込（円）」） */
function priceLine(view: DestDetailView, locale: Locale): string | null {
  const t = view.accommodation?.priceTable ?? view.experience?.priceTable ?? null;
  if (!t || !t.rows.length) return null;
  const min = Math.min(...t.rows.map((r) => r.min));
  const max = Math.max(...t.rows.map((r) => r.max));
  return `${range(min, max, locale)}${t.unitLabel ? `（${t.unitLabel}）` : ""}`;
}

type AccessLike = { station: string | null; modeLabel: string | null; minutes: number | null } | null | undefined;
function accessLine(view: DestDetailView, locale: Locale): string | null {
  const a: AccessLike = view.accommodation?.access ?? view.nature?.access ?? (view.building as { access?: AccessLike } | null)?.access ?? (view.hotspring as { access?: AccessLike } | null)?.access ?? (view.village as { access?: AccessLike } | null)?.access;
  if (!a || (!a.station && !a.minutes)) return null;
  const from = a.station ? (locale === "ja" ? `${a.station}から` : `from ${a.station}`) : "";
  const how = [a.modeLabel, a.minutes ? (locale === "ja" ? `${a.minutes}分` : `${a.minutes} min`) : null].filter(Boolean).join(" ");
  return [from, how].filter(Boolean).join(" ");
}

function timesLine(view: DestDetailView, locale: Locale): string | null {
  const s = view.accommodation?.stay;
  if (s && (s.checkIn || s.checkOut)) return locale === "ja" ? `チェックイン ${s.checkIn ?? "不明"}／アウト ${s.checkOut ?? "不明"}` : `Check-in ${s.checkIn ?? "?"} / out ${s.checkOut ?? "?"}`;
  const e = view.experience?.summary;
  if (e && (e.durationMinutes || e.reservationRequired !== null)) {
    const parts = [e.durationMinutes ? (locale === "ja" ? `所要 ${e.durationMinutes}分` : `${e.durationMinutes} min`) : null, e.reservationRequired ? (locale === "ja" ? "要予約" : "Booking required") : null];
    return parts.filter(Boolean).join(locale === "ja" ? "・" : ", ") || null;
  }
  return null;
}

/** 予約・公式のリンク。公式を先に、同じ URL は 1 つ */
function linksOf(view: DestDetailView): ShareLink[] {
  const raw = view.accommodation?.bookingLinks ?? view.experience?.bookingLinks ?? [];
  const seen = new Set<string>();
  return [...raw]
    .sort((a, b) => Number(b.isOfficial) - Number(a.isOfficial))
    .filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true)))
    .map((l) => ({ label: l.label, url: l.url }));
}

/** 予約が要る種類（宿・体験）か */
export const needsBooking = (it: Pick<ShareItem, "priced">): boolean => it.priced;
/** 予約できる状態か（予約が要る種類で、予約・公式のリンクがある） */
export const bookable = (it: Pick<ShareItem, "priced" | "links">): boolean => it.priced && it.links.length > 0;

export const mapUrlOf = (loc: { lat: number; lng: number } | null): string | null =>
  loc ? `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}` : null;

export function shareItemOf(view: DestDetailView, role: ShareRole, wandraraUrl: string, locale: Locale): ShareItem {
  return {
    role,
    title: view.title,
    kindLabel: view.kindLabel,
    areaLabel: view.areaLabel,
    summary: view.summary,
    price: priceLine(view, locale),
    priced: Boolean(view.accommodation || view.experience),
    times: timesLine(view, locale),
    access: accessLine(view, locale),
    wandraraUrl,
    mapUrl: mapUrlOf(view.location),
    links: linksOf(view),
  };
}

/** 貼り付け用の文。LINE などでそのまま読めるよう、記号と改行だけで組む */
export function shareText(title: string, items: ShareItem[], t: ShareText): string {
  const blocks = items.map((it) => {
    const lines = [`■ ${t.role[it.role]}：${it.title}（${it.kindLabel}・${it.areaLabel}）`];
    if (it.summary) lines.push(it.summary);
    if (it.priced) lines.push(`・${t.price} ${it.price ?? t.unknown}`);
    if (it.times) lines.push(`・${it.times}`);
    lines.push(`・${t.access} ${it.access ?? t.unknown}`);
    if (it.mapUrl) lines.push(`・${t.map} ${it.mapUrl}`);
    // 予約できる状態か：予約・公式のリンク。予約が要る種類（宿・体験）で無ければ「予約 不明」（データカタログで埋める所）
    for (const l of it.links) lines.push(`・${t.book}（${l.label}） ${l.url}`);
    if (!it.links.length && it.priced) lines.push(`・${t.book} ${t.unknown}`);
    lines.push(`・${t.more} ${it.wandraraUrl}`);
    return lines.join("\n");
  });
  return [t.heading(title), ...blocks, t.footer].join("\n\n");
}
