// 検証済みの content bundle を、DB に書く行の一覧（ImportPlan）に変える。DB には触らない。

type Localized = { ja?: string; en?: string; machine_translated?: string[] };
type Source = { type: string; name?: string; url?: string; retrieved_at: string; evidence?: string };
type BundleFact = { key: string; value?: unknown; unit?: string; status: "verified" | "unverified" | "unknown" | "conflict"; sources?: Source[]; note?: Localized };
type BundlePhoto = { url?: string; file?: string; source_page_url: string; license: string; credit?: string; alt?: Localized };
type BundlePrice = Record<string, unknown>;
export type BundleSpot = {
  external_ref: string;
  slug?: string;
  kind: "stay" | "place" | "experience";
  name: Localized;
  location: { area_id?: string; sources?: Source[] } & Record<string, unknown>;
  categories: string[];
  summary?: Localized;
  official_url?: string;
  booking_links?: unknown[];
  facts?: BundleFact[];
  prices?: BundlePrice[];
  photos?: BundlePhoto[];
  verification_status: "candidate" | "collected" | "verified";
};
type BundleArea = { id: string; parent_id?: string; name: Localized };
type BundleCategory = { id: string; mode: "place" | "experience"; parent_id?: string; name: Localized; icon?: string };
export type Bundle = { bundle_version: "1"; collected_at: string; collector: string; spots: BundleSpot[]; areas?: BundleArea[]; categories?: BundleCategory[] };

// bundle の外から渡すもの。imageFiles は bundle と同じ場所の images/ にある画像（相対パス）
export type PlanOptions = { imageFiles?: string[] };

// DB にすでにある ID。spots は id → external_ref（デモは null）
export type Refs = { areas: Set<string>; categories: Set<string>; spots: Map<string, string | null> };

export type ImportPlan = {
  // overwrite=true は bundle に書かれたもの（更新する）。false は取り込み側が作るもの（すでにあれば触らない）
  areas: { id: string; parent_id: string | null; name: Localized; sort: number; overwrite: boolean }[];
  categoryDefs: { id: string; mode: string; parent_id: string | null; name: Localized; icon: string; sort: number; overwrite: boolean }[];
  records: { external_ref: string; spot_id: string | null; verification_status: string; record: BundleSpot; collector: string; collected_at: string }[];
  removeRefs: string[];
  spots: { id: string; external_ref: string; kind: string; area_id: string | null; name: Localized; summary: Localized | null; location: unknown; official_url: string | null; booking_links: unknown[]; verification_status: string }[];
  categories: { spot_id: string; category_id: string }[];
  facts: { spot_id: string; key: string; label: Localized; value: Localized | null; status: string; source_name: string | null; source_url: string | null; checked_at: string | null; detail: Localized | null; sources: Source[]; sort: number }[];
  // 画像の取得元。アップロード後に photo.ts が公開 URL を決める
  photos: { spot_id: string; sort: number; src: { url: string } | { file: string }; license: string; credit: string | null; source_page_url: string | null; alt: Localized | null }[];
  prices: (BundlePrice & { spot_id: string; sort: number })[];
  warnings: string[];
  errors: string[];
};

const FACT_LABELS: Record<string, Localized> = {
  max_guests: { ja: "定員", en: "Max guests" },
  private_rental: { ja: "一棟貸し", en: "Private rental" },
  bedrooms: { ja: "寝室", en: "Bedrooms" },
  beds: { ja: "寝具", en: "Beds" },
  bathrooms: { ja: "浴室・トイレ", en: "Bathrooms" },
  bath_types: { ja: "お風呂", en: "Baths" },
  kitchen: { ja: "キッチン", en: "Kitchen" },
  bbq: { ja: "BBQ", en: "BBQ" },
  parking_spaces: { ja: "駐車場", en: "Parking" },
  wifi: { ja: "Wi-Fi", en: "Wi-Fi" },
  pets_allowed: { ja: "ペット", en: "Pets" },
  check_in: { ja: "チェックイン", en: "Check-in" },
  check_out: { ja: "チェックアウト", en: "Check-out" },
  min_nights: { ja: "最低泊数", en: "Minimum nights" },
  quiet_hours: { ja: "静粛時間", en: "Quiet hours" },
  privacy: { ja: "プライバシー", en: "Privacy" },
  connectivity: { ja: "携帯の電波", en: "Mobile signal" },
  nearest_station: { ja: "最寄り駅", en: "Nearest station" },
  access_by_car: { ja: "車でのアクセス", en: "By car" },
  season_access: { ja: "季節の道路状況", en: "Seasonal access" },
  duration_minutes: { ja: "所要時間", en: "Duration" },
  season_months: { ja: "できる時期", en: "Season" },
  reservation_required: { ja: "予約", en: "Reservation" },
  meeting_point: { ja: "集合場所", en: "Meeting point" },
  operating_hours: { ja: "営業時間", en: "Hours" },
  closed_days: { ja: "定休日", en: "Closed" },
  min_age: { ja: "年齢制限", en: "Minimum age" },
  difficulty: { ja: "難易度", en: "Difficulty" },
  weather_dependency: { ja: "雨天時", en: "In bad weather" },
  opening_hours: { ja: "開いている時間", en: "Opening hours" },
  entry_fee: { ja: "入場料", en: "Entry fee" },
  best_season: { ja: "見頃", en: "Best season" },
};

const UNITS: Record<string, [string, string]> = {
  person: ["人", " people"], minute: ["分", " min"], car: ["台", " cars"], yen: ["円", " JPY"], night: ["泊", " nights"],
};

const CODES: Record<string, [string, string]> = {
  indoor: ["内風呂", "Indoor bath"], open_air: ["露天風呂", "Open-air bath"], onsen: ["温泉", "Hot spring"],
  private: ["貸切風呂", "Private bath"], sauna: ["サウナ", "Sauna"],
  easy: ["やさしい", "Easy"], moderate: ["ふつう", "Moderate"], hard: ["きつい", "Hard"],
};

const SOURCE_TYPES: Record<string, string> = {
  official: "公式サイト", government: "自治体・公的機関", ota: "予約サイト", media: "メディア",
  review_site: "口コミサイト", field_research: "現地調査", prior_research: "過去の調査", other: "その他",
};

function isLocalized(v: unknown): v is Localized {
  return typeof v === "object" && v !== null && !Array.isArray(v) && ("ja" in v || "en" in v);
}

function both(ja: string, en: string): Localized {
  return { ja, en };
}

// 事実の値を、画面にそのまま出せる日英の文にする
export function formatFactValue(key: string, value: unknown, unit?: string): Localized | null {
  if (value === undefined || value === null) return null;
  if (isLocalized(value)) return { ja: value.ja, en: value.en };
  if (typeof value === "boolean") return value ? both("あり", "Yes") : both("なし", "No");
  if (typeof value === "number") {
    const u = unit ? UNITS[unit] : undefined;
    if (u) return both(`${value}${u[0]}`, `${value}${u[1]}`);
    return both(unit ? `${value} ${unit}` : String(value), unit ? `${value} ${unit}` : String(value));
  }
  if (Array.isArray(value)) {
    if (key === "season_months") return both(value.map((m) => `${m}月`).join("、"), value.join(", "));
    const parts = value.map((v) => (typeof v === "string" && CODES[v] ? CODES[v] : [String(v), String(v)]));
    return both(parts.map((p) => p[0]).join("、"), parts.map((p) => p[1]).join(", "));
  }
  if (typeof value === "string") return CODES[value] ? both(...CODES[value]) : both(value, value);
  return both(JSON.stringify(value), JSON.stringify(value));
}

export function slugify(ref: string): string {
  return ref.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

const NEW_SORT = 1000; // 取り込みで足したエリア・カテゴリは既存の後ろに並べる

export function planImport(bundle: Bundle, refs: Refs, options: PlanOptions = {}): ImportPlan {
  const plan: ImportPlan = { areas: [], categoryDefs: [], records: [], removeRefs: [], spots: [], categories: [], facts: [], photos: [], prices: [], warnings: [], errors: [] };
  const idByRef = new Map<string, string>();
  for (const [id, ref] of refs.spots) if (ref) idByRef.set(ref, id);
  const seenRefs = new Set<string>();
  const seenIds = new Set<string>();

  // bundle に書かれたエリア・カテゴリはそのまま追加・更新する
  const areaIds = new Set(refs.areas);
  const categoryIds = new Set(refs.categories);
  for (const a of bundle.areas ?? []) {
    plan.areas.push({ id: a.id, parent_id: a.parent_id ?? null, name: a.name, sort: NEW_SORT, overwrite: true });
    areaIds.add(a.id);
  }
  for (const c of bundle.categories ?? []) {
    plan.categoryDefs.push({ id: c.id, mode: c.mode, parent_id: c.parent_id ?? null, name: c.name, icon: c.icon ?? "grid", sort: NEW_SORT, overwrite: true });
    categoryIds.add(c.id);
  }
  for (const a of plan.areas) if (a.parent_id && !areaIds.has(a.parent_id)) plan.errors.push(`area ${a.id}: 親 "${a.parent_id}" が無い`);
  for (const c of plan.categoryDefs) if (c.parent_id && !categoryIds.has(c.parent_id)) plan.errors.push(`category ${c.id}: 親 "${c.parent_id}" が無い`);

  for (const s of bundle.spots) {
    const ref = s.external_ref;
    const err = (m: string) => plan.errors.push(`${ref}: ${m}`);
    const warn = (m: string) => plan.warnings.push(`${ref}: ${m}`);
    if (seenRefs.has(ref)) { err("同じ external_ref が bundle に 2 回ある"); continue; }
    seenRefs.add(ref);

    // 候補（名前だけ）は公開しない。原本だけ残し、公開済みなら取り下げる
    if (s.verification_status === "candidate") {
      plan.records.push({ external_ref: ref, spot_id: null, verification_status: s.verification_status, record: s, collector: bundle.collector, collected_at: bundle.collected_at });
      if (idByRef.has(ref)) plan.removeRefs.push(ref);
      continue;
    }

    const id = idByRef.get(ref) ?? (s.slug ?? slugify(ref));
    if (!idByRef.has(ref) && refs.spots.has(id)) { err(`slug "${id}" は別のスポットが使っている。slug を指定する`); continue; }
    if (seenIds.has(id)) { err(`slug "${id}" が bundle 内で重複している`); continue; }

    const keys = new Set<string>();
    for (const f of s.facts ?? []) {
      if (keys.has(f.key)) err(`事実 "${f.key}" が重複している`);
      keys.add(f.key);
    }
    if (plan.errors.some((e) => e.startsWith(`${ref}:`))) continue;
    seenIds.add(id);

    // エリアは制限にしない。無い ID は市町村名で作り、ID が無ければエリア無しで入れる
    const areaId = s.location.area_id ?? null;
    if (!areaId) warn("エリアが無いので、エリアで絞ると出ない");
    else if (!areaIds.has(areaId)) {
      const name = String(s.location.municipality ?? s.location.district ?? areaId);
      plan.areas.push({ id: areaId, parent_id: null, name: both(name, areaId), sort: NEW_SORT, overwrite: false });
      areaIds.add(areaId);
      warn(`エリア "${areaId}"（${name}）を作る。親の地域は bundle の areas で指定できる`);
    }

    // カテゴリも無ければ作る。new: は外して扱う
    const cats = [...new Set(s.categories.map((c) => c.replace(/^new:/, "")))];
    for (const c of cats) {
      if (categoryIds.has(c)) continue;
      const mode = s.kind === "experience" ? "experience" : "place";
      plan.categoryDefs.push({ id: c, mode, parent_id: null, name: both(c, c), icon: "grid", sort: NEW_SORT, overwrite: false });
      categoryIds.add(c);
      warn(`カテゴリ "${c}"（${mode}）を作る。名前とアイコンは bundle の categories で指定できる`);
    }

    const { sources: locSources, ...location } = s.location;
    plan.records.push({ external_ref: ref, spot_id: id, verification_status: s.verification_status, record: s, collector: bundle.collector, collected_at: bundle.collected_at });
    plan.spots.push({
      id, external_ref: ref, kind: s.kind, area_id: areaId, name: s.name, summary: s.summary ?? null,
      location: { ...location, sources: locSources ?? [] }, official_url: s.official_url ?? null,
      booking_links: s.booking_links ?? [], verification_status: s.verification_status,
    });
    for (const c of cats) plan.categories.push({ spot_id: id, category_id: c });

    (s.facts ?? []).forEach((f, i) => {
      const first = f.sources?.[0];
      const conflict = f.status === "conflict";
      plan.facts.push({
        spot_id: id, key: f.key, label: FACT_LABELS[f.key] ?? both(f.key, f.key),
        value: f.status === "unknown" ? null : formatFactValue(f.key, f.value, f.unit),
        // 画面は conflict を持たないので未確認として出し、食い違いを詳細に書く
        status: conflict ? "unverified" : f.status,
        source_name: first ? (first.name ?? SOURCE_TYPES[first.type] ?? first.type) : null,
        source_url: first?.url ?? null,
        checked_at: first?.retrieved_at ?? null,
        detail: conflict ? both("出典によって情報が食い違っています。予約前に直接確認してください。", "Sources disagree. Please confirm before booking.") : (f.note ?? null),
        sources: f.sources ?? [], sort: i,
      });
    });

    // 写真は権利を問わず取り込む。url / file が無いものは取りようがないので外す
    const photos = (s.photos ?? []).filter((p) => p.file || p.url);
    photos.forEach((p, i) => {
      plan.photos.push({ spot_id: id, sort: i, src: p.file ? { file: p.file } : { url: p.url! }, license: p.license, credit: p.credit ?? null, source_page_url: p.source_page_url, alt: p.alt ?? null });
    });
    // spot が 1 件の bundle で写真の指定が無ければ、images/ の画像を名前順に使う
    if (photos.length === 0 && bundle.spots.length === 1 && (options.imageFiles?.length ?? 0) > 0) {
      const page = s.photos?.[0]?.source_page_url ?? s.official_url ?? null;
      [...options.imageFiles!].sort().forEach((file, i) => {
        plan.photos.push({ spot_id: id, sort: i, src: { file }, license: "none", credit: null, source_page_url: page, alt: null });
      });
      warn(`写真の指定が無いので images/ の ${options.imageFiles!.length} 枚を使う`);
    }

    (s.prices ?? []).forEach((p, i) => plan.prices.push({ ...p, spot_id: id, sort: i }));
  }
  return plan;
}
