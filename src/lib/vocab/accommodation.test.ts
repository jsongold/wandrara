import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as vocab from "./accommodation.ts";
import {
  AMENITY_GROUP_LIST,
  AMENITY_LIST,
  BATH_KIND_LIST,
  BATH_KINDS,
  amenityGroupOf,
  amenityOptions,
  labelOf,
  type Term,
} from "./accommodation.ts";

// *_LIST をすべて集める
const lists = Object.entries(vocab).filter(([name, v]) => name.endsWith("_LIST") && Array.isArray(v)) as [string, readonly Term[]][];

describe("語彙の一覧", () => {
  it("どの一覧もコードが重ならない", () => {
    expect(lists.length).toBeGreaterThan(20);
    for (const [name, list] of lists) {
      const codes = list.map((t) => t.code);
      expect(new Set(codes).size, name).toBe(codes.length);
    }
  });

  it("どの一覧も表示名がある", () => {
    for (const [name, list] of lists) {
      for (const t of list) expect(t.label, `${name}.${t.code}`).not.toBe("");
    }
  });

  it("どの一覧も英語の表示名があり、日本語が混ざらない", () => {
    const terms = [...lists.flatMap(([name, list]) => list.map((t) => [`${name}.${t.code}`, t] as const))];
    for (const item of AMENITY_LIST) for (const o of item.options) terms.push([`${item.code}.${o.code}`, o]);
    for (const [key, t] of terms) {
      expect(t.en, key).not.toBe("");
      expect(t.en, key).not.toMatch(/[ぁ-んァ-ン一-龥]/);
    }
  });

  it("コードの tuple は一覧と同じ並び", () => {
    expect(BATH_KINDS).toEqual(BATH_KIND_LIST.map((t) => t.code));
  });

  it("z.enum にそのまま渡せる", () => {
    const schema = z.enum(BATH_KINDS);
    expect(schema.parse("sauna")).toBe("sauna");
    expect(schema.safeParse("onsen").success).toBe(false);
  });
});

describe("設備", () => {
  it("中カテゴリ 11・小カテゴリ 47", () => {
    expect(AMENITY_GROUP_LIST).toHaveLength(11);
    expect(AMENITY_LIST).toHaveLength(47);
  });

  it("小カテゴリはどれもちょうど 1 つの中カテゴリに入る", () => {
    for (const item of AMENITY_LIST) {
      const groups = AMENITY_GROUP_LIST.filter((g) => g.code === item.group);
      expect(groups, item.code).toHaveLength(1);
    }
  });

  it("options のコードは小カテゴリの中で重ならず、表示名がある", () => {
    for (const item of AMENITY_LIST) {
      const codes = item.options.map((o) => o.code);
      expect(new Set(codes).size, item.code).toBe(codes.length);
      for (const o of item.options) expect(o.label, `${item.code}.${o.code}`).not.toBe("");
    }
  });

  it("amenityGroupOf は中カテゴリを返し、知らないコードは undefined", () => {
    expect(amenityGroupOf("bbq")).toEqual({ code: "outdoor", label: "屋外", en: "Outdoor" });
    expect(amenityGroupOf("nope")).toBeUndefined();
  });

  it("amenityOptions は options を返し、無いときは空", () => {
    expect(amenityOptions("bbq").map((o) => o.code)).toEqual(["electric_grill", "charcoal", "gas", "covered"]);
    expect(amenityOptions("wifi")).toEqual([]);
    expect(amenityOptions("nope")).toEqual([]);
  });
});

describe("labelOf", () => {
  it("表示名を返す", () => {
    expect(labelOf(BATH_KIND_LIST, "open_air")).toBe("露天風呂");
  });

  it("知らないコードはコードのまま返す", () => {
    expect(labelOf(BATH_KIND_LIST, "onsen")).toBe("onsen");
    expect(labelOf(BATH_KIND_LIST, "onsen", "en")).toBe("onsen");
  });

  it("en は英語の表示名を返す", () => {
    expect(labelOf(BATH_KIND_LIST, "open_air", "en")).toBe("Open-air bath");
    expect(labelOf(BATH_KIND_LIST, "open_air", "ja")).toBe("露天風呂");
  });
});
