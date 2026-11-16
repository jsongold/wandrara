import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { toBuildingView } from "@/lib/building/view";
import { sampleBuildingDetails } from "@/lib/building/sample";
import { toHotspringView } from "@/lib/hotspring/view";
import { sampleHotspringDetails } from "@/lib/hotspring/sample";
import { toVillageView } from "@/lib/village/view";
import { sampleVillageDetails } from "@/lib/village/sample";
import type { Locale } from "@/lib/types";
import { BuildingSections, BuildingSummaryPill } from "./building/BuildingSections";
import { HotspringSections, HotspringSummaryPill } from "./hotspring/HotspringSections";
import { VillageSections, VillageSummaryPill } from "./village/VillageSections";

const map = <div>MAP</div>;
const input = (locale: Locale, details: unknown) => ({ details, lat: 35, lng: 139, locale });
const bld = (locale: Locale) => toBuildingView(input(locale, sampleBuildingDetails()))!;
const hot = (locale: Locale) => toHotspringView(input(locale, sampleHotspringDetails()))!;
const vil = (locale: Locale) => toVillageView(input(locale, sampleVillageDetails()))!;
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const headings = (h: string) => [...h.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((m) => m[1]);

describe("建物の詳細", () => {
  it("ja: 見出しが決まった順に並ぶ", () => {
    const h = html(<BuildingSections view={bld("ja")} map={map} locale="ja" />);
    expect(headings(h)).toEqual(["時間", "料金", "催し", "アクセス", "注意点", "出典"]);
    expect(h).toContain("MAP");
    expect(h).toContain("ガラスの冬展");
    expect(h).toContain("入館の締め切り");
    expect(h).toContain("16:30");
  });
  it("ja: 概要の丸い行", () => {
    const h = html(<BuildingSummaryPill summary={bld("ja").summary} locale="ja" />);
    expect(h).toContain("開館");
    expect(h).toContain("09:00〜17:00");
    expect(h).toContain("入館");
    expect(h).toContain("1,500 円");
  });
  it("予約のリンクは注意点の後に出る", () => {
    const v = toBuildingView(input("ja", { ...sampleBuildingDetails(), booking_links: [{ label: "予約", url: "https://example.com/b" }] }))!;
    expect(headings(html(<BuildingSections view={v} map={map} locale="ja" />))).toEqual(["時間", "料金", "催し", "アクセス", "注意点", "予約", "出典"]);
  });
  it("en: 英語で出る", () => {
    const h = html(<BuildingSections view={bld("en")} map={map} locale="en" />);
    expect(headings(h)).toContain("Admission");
    expect(h).toContain("Winter glass exhibition");
  });
  it("details が空なら見出しは地図のアクセスだけ", () => {
    const v = toBuildingView(input("ja", {}))!;
    expect(headings(html(<BuildingSections view={v} map={map} locale="ja" />))).toEqual(["アクセス"]);
    expect(html(<BuildingSummaryPill summary={v.summary} locale="ja" />)).toBe("");
  });
});

describe("日帰り温泉の詳細", () => {
  it("ja: 見出しが決まった順に並ぶ", () => {
    const h = html(<HotspringSections view={hot("ja")} map={map} locale="ja" />);
    expect(headings(h)).toEqual(["風呂", "料金", "時間", "設備", "アクセス", "注意点", "出典"]);
    expect(h).toContain("露天風呂");
    expect(h).toContain("アルカリ性単純温泉");
    expect(h).toContain("貸し出し（200 円）");
    expect(h).toContain("受付の締め切り");
  });
  it("ja: 概要の丸い行", () => {
    const h = html(<HotspringSummaryPill summary={hot("ja").summary} locale="ja" />);
    expect(h).toContain("営業");
    expect(h).toContain("10:00〜21:00");
    expect(h).toContain("大人");
    expect(h).toContain("1,000 円");
  });
  it("en: 英語で出る", () => {
    const h = html(<HotspringSections view={hot("en")} map={map} locale="en" />);
    expect(headings(h)).toContain("Baths");
    expect(h).toContain("Open-air bath");
  });
});

describe("まちの詳細", () => {
  it("ja: 見出しが決まった順に並ぶ", () => {
    const h = html(<VillageSections view={vil("ja")} map={map} locale="ja" />);
    expect(headings(h)).toEqual(["歩き方", "店の時間", "催し", "アクセス", "注意点", "出典"]);
    expect(h).toContain("竹林と寺めぐり");
    expect(h).toContain("もみじ祭り");
    expect(h).toContain("店が開いている時間");
  });
  it("ja: 概要の丸い行", () => {
    const h = html(<VillageSummaryPill summary={vil("ja").summary} locale="ja" />);
    expect(h).toContain("歩く");
    expect(h).toContain("約 60 分");
    expect(h).toContain("10:00〜17:00");
  });
  it("en: 英語で出る", () => {
    const h = html(<VillageSections view={vil("en")} map={map} locale="en" />);
    expect(headings(h)).toContain("Walks");
    expect(h).toContain("Bamboo grove and temples");
  });
});
