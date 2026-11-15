// CoreDef の項目名・種類を言語に合わせる。日本語は CoreDef（正本）、英語は core-labels-en.ts。
// 英語の無い項目は日本語で出す（項目の並びと有無は CoreDef が決める）
import type { CoreDef } from "../../db/schema/_shared";
import type { Locale } from "../types";
import { CORE_LABELS_EN } from "./core-labels-en";

export type CoreLabels = {
  label: string;
  columns: Record<string, string>;
  kindLabels: Record<string, string>;
  details: Record<string, { label: string; columns: Record<string, string> }>;
};

const pick = (ja: Record<string, string>, other: Record<string, string> | undefined) =>
  Object.fromEntries(Object.entries(ja).map(([k, v]) => [k, other?.[k] ?? v]));

export function coreLabels(core: CoreDef, locale: Locale): CoreLabels {
  const en = locale === "en" ? CORE_LABELS_EN[core.coreType] : undefined;
  return {
    label: en?.label ?? core.label,
    columns: pick(core.columns, en?.columns),
    kindLabels: pick(core.kindLabels, en?.kindLabels),
    details: Object.fromEntries(
      core.details.map((d) => [
        d.key,
        { label: en?.details[d.key]?.label ?? d.label, columns: pick(d.columns, en?.details[d.key]?.columns) },
      ]),
    ),
  };
}
