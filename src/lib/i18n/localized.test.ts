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
  it("要求した言語があればそれ", () => {
    expect(resolveLocalizedText({ ja: "宿", en: "Stay" }, "en")).toEqual({ text: "Stay", lang: "en", fallback: false });
  });
  it("無ければ ja → en → ある言語のどれか", () => {
    expect(resolveLocalizedText({ ja: "宿", en: "Stay" }, "fr")).toEqual({ text: "宿", lang: "ja", fallback: true });
    expect(resolveLocalizedText({ en: "Stay" }, "ja")).toEqual({ text: "Stay", lang: "en", fallback: true });
    expect(resolveLocalizedText({ de: "Haus" }, "ja")).toEqual({ text: "Haus", lang: "de", fallback: true });
  });
  it("空の文は訳が無いものとして飛ばす", () => {
    expect(resolveLocalizedText({ ja: "", en: "Stay" }, "ja")).toEqual({ text: "Stay", lang: "en", fallback: true });
    expect(resolveLocalizedText({ ja: " " }, "ja")).toEqual({ text: "", lang: null, fallback: false });
  });
  it("null は空", () => {
    expect(resolveLocalizedText(null, "ja")).toEqual({ text: "", lang: null, fallback: false });
  });
});
