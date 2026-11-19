import { describe, expect, it } from "vitest";
import { collectLanguages, localizedTextSchema, resolveLocalizedText } from "./localized";

describe("localizedTextSchema", () => {
  it("言語タグの形のキーと、空でない文を通す", () => {
    expect(localizedTextSchema.safeParse({ ja: "宿", en: "Stay", "zh-Hant": "住宿", "pt-BR": "Pousada" }).success).toBe(true);
  });
  it("形の違うキーを弾く", () => {
    for (const k of ["JA", "j", "ja_JP", "zh-hant", "english"]) expect(localizedTextSchema.safeParse({ [k]: "x" }).success).toBe(false);
  });
  it("空の文を弾く", () => {
    expect(localizedTextSchema.safeParse({ ja: "" }).success).toBe(false);
    expect(localizedTextSchema.safeParse({ ja: "  " }).success).toBe(false);
  });
});

describe("collectLanguages", () => {
  it("parse に出てきた言語タグを集め、外では集めない", () => {
    const { result, languages } = collectLanguages(() => localizedTextSchema.safeParse({ ja: "宿", fr: "Hôtel" }));
    expect(result.success).toBe(true);
    expect([...languages].sort()).toEqual(["fr", "ja"]);
    const after = collectLanguages(() => 0);
    localizedTextSchema.parse({ de: "Haus" });
    expect(after.languages.size).toBe(0);
  });
});

describe("resolveLocalizedText", () => {
  it("要求した言語の文を出す", () => {
    expect(resolveLocalizedText({ ja: "宿", en: "Stay" }, "en")).toEqual({ text: "Stay" });
  });
  it("要求した言語が無ければ空（別の言語では出さない）", () => {
    expect(resolveLocalizedText({ ja: "宿" }, "en")).toEqual({ text: "" });
    expect(resolveLocalizedText(null, "ja")).toEqual({ text: "" });
  });
});
