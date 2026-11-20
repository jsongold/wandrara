// 予約に使うサイト（純関数）。予約リンクの URL からどのサイトかを決め、選んだサイトのリンクだけを選んだ順に残す。
// 公式は details の is_official で決める（ドメインでは決めない）
export type SiteId = "official" | "rakuten" | "jalan" | "ikyu" | "booking" | "airbnb";

export const BOOKING_SITES: { id: SiteId; hosts: string[] }[] = [
  { id: "official", hosts: [] },
  { id: "rakuten", hosts: ["travel.rakuten.co.jp"] },
  { id: "jalan", hosts: ["jalan.net"] },
  { id: "ikyu", hosts: ["ikyu.com"] },
  { id: "booking", hosts: ["booking.com"] },
  { id: "airbnb", hosts: ["airbnb.com", "airbnb.jp"] },
];
export const DEFAULT_SITES: SiteId[] = ["official"];

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** リンクのサイト。公式の印が先。どれでもなければ null */
export function siteOf(link: { url: string; isOfficial?: boolean }): SiteId | null {
  if (link.isOfficial) return "official";
  const host = hostOf(link.url);
  return BOOKING_SITES.find((s) => s.hosts.some((h) => host === h || host.endsWith(`.${h}`)))?.id ?? null;
}

/** 選んだサイトのリンクだけを、選んだ順に残す */
export function linksFor<T extends { site: SiteId | null }>(links: T[], sites: SiteId[]): T[] {
  return sites.flatMap((s) => links.filter((l) => l.site === s));
}

/** 選んだサイトのうち、リンクが無いもの */
export function missingSites(links: { site: SiteId | null }[], sites: SiteId[]): SiteId[] {
  return sites.filter((s) => !links.some((l) => l.site === s));
}

export function parseSites(raw: string | null): SiteId[] {
  const known = new Set(BOOKING_SITES.map((s) => s.id));
  const list = [...new Set((raw ?? "").split(","))].filter((x): x is SiteId => known.has(x as SiteId));
  return list.length ? list : DEFAULT_SITES;
}
