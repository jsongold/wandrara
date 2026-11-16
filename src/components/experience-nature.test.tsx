import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { toExperienceView } from "@/lib/experience/view";
import { sampleExperienceDetails } from "@/lib/experience/sample";
import { toNatureView } from "@/lib/nature/view";
import { sampleNatureDetails } from "@/lib/nature/sample";
import type { Locale } from "@/lib/types";
import { ExperienceSections, ExperienceSummaryPill } from "./experience/ExperienceSections";
import { NatureSections, NatureSummaryPill } from "./nature/NatureSections";

const map = <div>MAP</div>;
const exp = (locale: Locale) =>
  toExperienceView({ details: sampleExperienceDetails(), durationMinutes: 90, reservationRequired: true, officialUrl: "https://example.com/", locale })!;
const nat = (locale: Locale) => toNatureView({ details: sampleNatureDetails(), lat: 35, lng: 139, locale })!;
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const headings = (h: string) => [...h.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((m) => m[1]);

describe("体験の詳細", () => {
  it("ja: 見出しが決まった順に並ぶ", () => {
    const h = html(<ExperienceSections view={exp("ja")} map={map} locale="ja" />);
    expect(headings(h)).toEqual(["料金（参考）", "コース", "開催", "集合場所", "含まれるもの", "注意点", "予約", "出典"]);
    expect(h).toContain("MAP");
    expect(h).toContain("屋内の見学に変える");
    expect(h).toContain("歩きやすい靴");
  });
  it("ja: 概要の丸い行", () => {
    const h = html(<ExperienceSummaryPill summary={exp("ja").summary} locale="ja" />);
    expect(h).toContain("所要");
    expect(h).toContain("90 分");
    expect(h).toContain("必要");
  });
  it("en: 英語で出る", () => {
    const h = html(<ExperienceSections view={exp("en")} map={map} locale="en" />);
    expect(headings(h)).toContain("Prices (guide)");
    expect(h).toContain("Moves indoors");
  });
  it("details が空なら見出しは地図の集合場所だけ", () => {
    const v = toExperienceView({ details: {}, durationMinutes: null, reservationRequired: null, officialUrl: null, locale: "ja" })!;
    expect(headings(html(<ExperienceSections view={v} map={map} locale="ja" />))).toEqual(["集合場所"]);
    expect(html(<ExperienceSummaryPill summary={v.summary} locale="ja" />)).toBe("");
  });
});

describe("自然の詳細", () => {
  it("ja: 見出しが決まった順に並ぶ", () => {
    const h = html(<NatureSections view={nat("ja")} map={map} locale="ja" />);
    expect(headings(h)).toEqual(["見頃", "時間・料金", "アクセス", "歩く道", "規制", "注意点", "出典"]);
    expect(h).toContain("岬めぐりコース");
    expect(h).toContain("2026-12-01〜2027-02-28");
    expect(h).toContain("120 m");
  });
  it("ja: 概要の丸い行", () => {
    const h = html(<NatureSummaryPill summary={nat("ja").summary} locale="ja" />);
    expect(h).toContain("見頃");
    expect(h).toContain("入場無料");
  });
  it("en: 英語で出る", () => {
    const h = html(<NatureSections view={nat("en")} map={map} locale="en" />);
    expect(headings(h)).toContain("Best season");
    expect(h).toContain("Cape loop");
  });
});
