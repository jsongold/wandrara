// 言語ごとの文（LocalizedText）と言語タグの形。どの言語があるかの正本は DB の languages 表（ここでは形だけ決める）
// 言語は 3 種類：訳文の言語（languages 表）・画面の言語（locale.ts の LOCALES）・案内言語（体験の courses[].languages。値は languages 表のタグ）
import { z } from "zod";

/** 言語ごとの文。例 {"ja": "...", "en": "..."}。キーは languages 表のタグ */
export type LocalizedText = Record<string, string>;

/** 言語タグの形（BCP 47 の 言語[-文字][-地域]。例 ja・en・zh-Hant・pt-BR）。DB の languages_tag_check と同じ */
export const LANGUAGE_TAG_PATTERN = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$/;

// collectLanguages の中で parse している間だけ、出てきた言語タグを集める（zod の parse は同期なので、他の parse と混ざらない）
let collecting: Set<string> | null = null;

/** 言語タグ。形だけ確かめる。languages 表にあるかは取り込み（registerDest）が確かめる */
export const languageTagSchema = z
  .string()
  .regex(LANGUAGE_TAG_PATTERN, "言語タグの形が違う（例 ja・en・zh-Hant・pt-BR）")
  .refine((tag) => {
    collecting?.add(tag);
    return true;
  });

/** jsonb の LocalizedText。キーは言語タグ、値は空でない文字列 */
export const localizedTextSchema = z.record(languageTagSchema, z.string().refine((v) => v.trim() !== "", "空の文は入れない（訳が無い言語はキーごと省く）"));

/** run の中の parse に出てきた言語タグを集める */
export function collectLanguages<T>(run: () => T): { result: T; languages: Set<string> } {
  const languages = new Set<string>();
  const prev = collecting;
  collecting = languages;
  try {
    return { result: run(), languages };
  } finally {
    collecting = prev;
  }
}

/** 表示に使う文を選ぶ。要求した言語 → ja → en → ある言語のどれか の順。空の文は訳が無いものとして飛ばす */
export function resolveLocalizedText(
  text: LocalizedText | null | undefined,
  locale: string,
): { text: string; lang: string | null; fallback: boolean } {
  if (!text) return { text: "", lang: null, fallback: false };
  for (const lang of [locale, "ja", "en", ...Object.keys(text)]) {
    const v = text[lang];
    if (typeof v === "string" && v.trim() !== "") return { text: v, lang, fallback: lang !== locale };
  }
  return { text: "", lang: null, fallback: false };
}
