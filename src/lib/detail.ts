// dest の詳細を読む。公開中のものだけ RLS で見える。誰にでも同じ内容なので 'use cache'。
import { createClient } from "@supabase/supabase-js";
import { getTableColumns, getTableName } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { cacheLife } from "next/cache";
import { toAccommodationView, type AccommodationView } from "./accommodation/view";
import { toExperienceView, type ExperienceView } from "./experience/view";
import { getCatalog, photoUrl } from "./data";
import { areaLabel, resolveLocalizedText } from "./feed";
import { coreLabels } from "./i18n/core-labels";
import { messages } from "./i18n/messages";
import { toNatureView, type NatureView } from "./nature/view";
import { coreByType } from "./ingest/cores";
import type { CoreDef } from "../db/schema/_shared";
import type { FactView, Locale, Photo } from "./types";

export type DestDetailView = {
  id: string;
  title: string;
  areaLabel: string;
  kindLabel: string;
  summary: string | null;
  isDemo: boolean;
  photos: Photo[];
  facts: FactView[];
  /** 宿の新しい画面の形。details が無いか形が違う宿と、宿でない dest は null（facts を出す） */
  accommodation: AccommodationView | null;
  /** 体験の新しい画面の形。details が無いか形が違う体験と、体験でない dest は null（facts を出す） */
  experience: ExperienceView | null;
  /** 自然の新しい画面の形。details が無いか形が違う自然と、自然でない dest は null（facts を出す） */
  nature: NatureView | null;
};

type Row = Record<string, unknown>;

/** 画面に出す値の文字列。null は null のまま返す（呼び出し側で捨てる） */
export function formatValue(v: unknown, locale: Locale, kindLabels: Record<string, string> = {}): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? messages(locale).common.yes : messages(locale).common.no;
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    if (kindLabels[v]) return kindLabels[v];
    return /^\d{2}:\d{2}:\d{2}$/.test(v) ? v.slice(0, 5) : v;
  }
  if (Array.isArray(v)) return v.length ? v.map((x) => formatValue(x, locale)).filter(Boolean).join(messages(locale).common.listSep) : null;
  if (typeof v === "object") return resolveLocalizedText(v as Record<string, string>, locale).text || null;
  return String(v);
}

export type ColumnMap = { prop: string; name: string; label: string }[];

/** columns（プロパティ名 → ラベル）を、表の実際の列名（snake_case）に引き当てる */
export function columnMap(table: PgTable, columns: Record<string, string>): ColumnMap {
  const cols = getTableColumns(table);
  return Object.entries(columns).flatMap(([prop, label]) => (cols[prop] ? [{ prop, name: cols[prop].name, label }] : []));
}

/** 1 行を「ラベル：値」の並びにする（null の列は出さない） */
export function rowPairs(map: ColumnMap, row: Row, locale: Locale, kindLabels: Record<string, string> = {}): { label: string; value: string }[] {
  return map.flatMap((c) => {
    const value = formatValue(row[c.name], locale, c.prop === "kind" ? kindLabels : {});
    return value === null ? [] : [{ label: c.label, value }];
  });
}

const fact = (key: string, label: string, value: string, detail: string | null): FactView => ({
  key, label, value, status: "unverified", sourceName: null, sourceUrl: null, checkedAt: null, detail,
});

/** コアの列は 1 列 1 行。詳細の表は 1 件 1 行（先頭の値が見出し、全部は開くと出る） */
export function buildFacts(core: CoreDef, coreRow: Row | null, details: { key: string; rows: Row[] }[], locale: Locale): FactView[] {
  const facts: FactView[] = [];
  const L = coreLabels(core, locale);
  const sep = messages(locale).detail;
  if (coreRow) {
    for (const p of rowPairs(columnMap(core.table, L.columns), coreRow, locale, L.kindLabels)) {
      facts.push(fact(`core:${p.label}`, p.label, p.value, null));
    }
  }
  for (const def of core.details) {
    const rows = details.find((d) => d.key === def.key)?.rows ?? [];
    const labels = L.details[def.key];
    const map = columnMap(def.table, labels.columns);
    rows.forEach((row, i) => {
      const pairs = rowPairs(map, row, locale);
      if (pairs.length === 0) return;
      const label = rows.length > 1 ? `${labels.label} ${i + 1}` : labels.label;
      const detail = pairs.length > 1 ? pairs.map((p) => `${p.label}${sep.pairSep}${p.value}`).join(sep.rowSep) : null;
      facts.push(fact(`${def.key}:${String(row.id ?? i)}`, label, pairs[0].value, detail));
    });
  }
  return facts;
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY が未設定です");
  return { url, db: createClient(url, key, { auth: { persistSession: false } }) };
}

const names = (table: PgTable, columns: Record<string, string>) => columnMap(table, columns).map((c) => c.name);

export async function getDestDetail(slug: string, locale: Locale): Promise<DestDetailView | null> {
  "use cache";
  cacheLife("minutes");
  const { url, db } = supabase();
  const { data: dest, error } = await db.from("destinations").select("dest_id, core_type, is_demo").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Supabase の読み込みに失敗しました: ${error.message}`);
  if (!dest) return null;
  const core = coreByType(dest.core_type);
  if (!core) return null;
  const id: string = dest.dest_id;
  const isAcc = core.coreType === "accommodation";
  const isExp = core.coreType === "experience";
  const isNat = core.coreType === "nature";
  // 宿・体験・自然は details と、画面の 1 行・料金のリンク・地図に使う列も読む
  const extraCols = isAcc
    ? ["details", "check_in", "check_out", "official_url"]
    : isExp
      ? ["details", "duration_minutes", "reservation_required", "official_url"]
      : isNat
        ? ["details", "lat", "lng"]
        : [];
  const coreCols = [...new Set(["region_id", ...names(core.table, core.columns), ...extraCols])];

  const [coreRes, textsRes, photosRes, catalog, ...detailRes] = await Promise.all([
    db.from(getTableName(core.table)).select(coreCols.join(", ")).eq("dest_id", id).maybeSingle(),
    db.from(getTableName(core.texts)).select("lang, name, summary").eq("dest_id", id),
    db.from("dest_photos").select("storage_key, license, credit, subject_key").eq("dest_id", id).order("sort"),
    getCatalog(),
    ...core.details.map((d) =>
      db.from(getTableName(d.table)).select(["id", ...names(d.table, d.columns)].join(", ")).eq("dest_id", id).order("sort"),
    ),
  ]);
  for (const r of [coreRes, textsRes, photosRes, ...detailRes]) {
    if (r.error) throw new Error(`Supabase の読み込みに失敗しました: ${r.error.message}`);
  }

  const texts = (textsRes.data ?? []) as unknown as { lang: string; name: string; summary: string | null }[];
  const pick = (f: "name" | "summary") => Object.fromEntries(texts.filter((x) => x[f]).map((x) => [x.lang, x[f] as string]));
  const coreRow = (coreRes.data ?? null) as unknown as Row | null;
  const details = core.details.map((d, i) => ({ key: d.key, rows: (detailRes[i].data ?? []) as unknown as Row[] }));
  const photoRows = (photosRes.data ?? []) as unknown as { storage_key: string; license: string | null; credit: string | null; subject_key: string | null }[];
  const photos = photoRows.map((p) => ({
    subjectKey: p.subject_key,
    photo: { url: photoUrl(url, p.storage_key), license: p.license, credit: p.credit, isDemo: false, placeholderSky: null, placeholderLand: null } satisfies Photo,
  }));
  const str = (k: string) => (typeof coreRow?.[k] === "string" ? (coreRow[k] as string) : null);
  const accommodation = isAcc
    ? toAccommodationView({ details: coreRow?.details ?? null, checkIn: str("check_in"), checkOut: str("check_out"), officialUrl: str("official_url"), photos, locale })
    : null;
  const bool = (k: string) => (typeof coreRow?.[k] === "boolean" ? (coreRow[k] as boolean) : null);
  const numOf = (k: string) => (typeof coreRow?.[k] === "number" ? (coreRow[k] as number) : null);
  const experience = isExp
    ? toExperienceView({
        details: coreRow?.details ?? null,
        durationMinutes: numOf("duration_minutes"),
        reservationRequired: bool("reservation_required"),
        officialUrl: str("official_url"),
        locale,
      })
    : null;
  const nature = isNat ? toNatureView({ details: coreRow?.details ?? null, lat: numOf("lat"), lng: numOf("lng"), locale }) : null;

  return {
    id,
    title: resolveLocalizedText(pick("name"), locale).text,
    areaLabel: areaLabel((coreRow?.region_id as string | null) ?? null, catalog.regions, locale),
    // 新しい画面の宿・体験・自然は種類（一棟貸し・ツアー・海岸…）を出す。ほかは今どおりコアの名前
    kindLabel: ((accommodation ?? experience ?? nature) && coreLabels(core, locale).kindLabels[str("kind") ?? ""]) || coreLabels(core, locale).label,
    summary: resolveLocalizedText(pick("summary"), locale).text || null,
    isDemo: dest.is_demo,
    photos: photos.map((p) => p.photo),
    facts: buildFacts(core, coreRow, details, locale),
    accommodation,
    experience,
    nature,
  };
}
