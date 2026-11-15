import { describe, expect, it } from "vitest";
import type { CoreDef } from "../../db/schema/_shared";
import { CORES } from "../ingest/cores";
import { coreLabels } from "./core-labels";
import { CORE_LABELS_EN, type CoreLabelsEn } from "./core-labels-en";

const JA = /[ぁ-んァ-ン一-龥]/;

/** 項目名・種類の全部を「パス → 文言」に並べる（CoreDef と英語の表を同じ形で比べるため） */
function flatJa(core: CoreDef): Record<string, string> {
  const t = core.coreType;
  return {
    [`${t}.label`]: core.label,
    ...Object.fromEntries(Object.entries(core.columns).map(([k, v]) => [`${t}.columns.${k}`, v])),
    ...Object.fromEntries(Object.entries(core.kindLabels).map(([k, v]) => [`${t}.kindLabels.${k}`, v])),
    ...Object.fromEntries(
      core.details.flatMap((d) => [
        [`${t}.details.${d.key}.label`, d.label],
        ...Object.entries(d.columns).map(([k, v]) => [`${t}.details.${d.key}.columns.${k}`, v]),
      ]),
    ),
  };
}

function flatEn(en: CoreLabelsEn): Record<string, string> {
  return Object.fromEntries(
    Object.entries(en).flatMap(([t, c]) => [
      [`${t}.label`, c.label],
      ...Object.entries(c.columns).map(([k, v]) => [`${t}.columns.${k}`, v]),
      ...Object.entries(c.kindLabels).map(([k, v]) => [`${t}.kindLabels.${k}`, v]),
      ...Object.entries(c.details).flatMap(([key, d]) => [
        [`${t}.details.${key}.label`, d.label],
        ...Object.entries(d.columns).map(([k, v]) => [`${t}.details.${key}.columns.${k}`, v]),
      ]),
    ]),
  );
}

describe("CORE_LABELS_EN", () => {
  const ja = Object.assign({}, ...CORES.map(flatJa)) as Record<string, string>;
  const en = flatEn(CORE_LABELS_EN);

  it("CoreDef のすべての項目名・種類に英語がある（書き忘れを見つける）", () => {
    expect(Object.keys(ja).filter((k) => !(k in en))).toEqual([]);
  });

  it("CoreDef に無い項目が無い（名前の打ち間違いを見つける）", () => {
    expect(Object.keys(en).filter((k) => !(k in ja))).toEqual([]);
  });

  it("英語に日本語が残っていない", () => {
    expect(Object.entries(en).filter(([, v]) => JA.test(v)).map(([k]) => k)).toEqual([]);
  });
});

describe("coreLabels", () => {
  const acc = CORES.find((c) => c.coreType === "accommodation")!;

  it("ja は CoreDef のまま、en は英語", () => {
    expect(coreLabels(acc, "ja").label).toBe(acc.label);
    expect(coreLabels(acc, "ja").kindLabels.private_rental).toBe("一棟貸し");
    expect(coreLabels(acc, "en").kindLabels.private_rental).toBe("Private rental");
  });

  it("英語が無い項目は日本語で出す", () => {
    const missing = { ...acc, columns: { ...acc.columns, newColumn: "新しい列" } };
    expect(coreLabels(missing, "en").columns.newColumn).toBe("新しい列");
    expect(coreLabels(missing, "en").columns.checkIn).toBe("Check-in");
  });
});
