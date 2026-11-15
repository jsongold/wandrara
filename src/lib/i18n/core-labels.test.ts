import { describe, expect, it } from "vitest";
import { CORES } from "../ingest/cores";
import { coreLabels } from "./core-labels";
import { CORE_LABELS_EN } from "./core-labels-en";

const JA = /[ぁ-んァ-ン一-龥]/;

describe("coreLabels", () => {
  it("すべての項目名・種類に英語がある（日本語が残っていない）", () => {
    const left: string[] = [];
    for (const core of CORES) {
      const en = coreLabels(core, "en");
      const all = [
        [`${core.coreType}.label`, en.label],
        ...Object.entries(en.columns).map(([k, v]) => [`${core.coreType}.columns.${k}`, v]),
        ...Object.entries(en.kindLabels).map(([k, v]) => [`${core.coreType}.kindLabels.${k}`, v]),
        ...Object.entries(en.details).flatMap(([key, d]) => [
          [`${core.coreType}.details.${key}.label`, d.label],
          ...Object.entries(d.columns).map(([k, v]) => [`${core.coreType}.details.${key}.columns.${k}`, v]),
        ]),
      ];
      left.push(...all.filter(([, v]) => JA.test(v)).map(([k]) => k));
    }
    expect(left).toEqual([]);
  });

  it("英語の表に、CoreDef に無い項目が無い（名前の打ち間違いを見つける）", () => {
    const extra: string[] = [];
    for (const [type, en] of Object.entries(CORE_LABELS_EN)) {
      const core = CORES.find((c) => c.coreType === type);
      if (!core) {
        extra.push(type);
        continue;
      }
      for (const k of Object.keys(en.columns)) if (!(k in core.columns)) extra.push(`${type}.columns.${k}`);
      for (const k of Object.keys(en.kindLabels)) if (!(k in core.kindLabels)) extra.push(`${type}.kindLabels.${k}`);
      for (const [key, d] of Object.entries(en.details)) {
        const def = core.details.find((x) => x.key === key);
        if (!def) extra.push(`${type}.details.${key}`);
        else for (const k of Object.keys(d.columns)) if (!(k in def.columns)) extra.push(`${type}.details.${key}.columns.${k}`);
      }
    }
    expect(extra).toEqual([]);
  });

  it("ja は CoreDef のまま", () => {
    const acc = CORES.find((c) => c.coreType === "accommodation")!;
    const ja = coreLabels(acc, "ja");
    expect(ja.label).toBe(acc.label);
    expect(ja.kindLabels.private_rental).toBe("一棟貸し");
    expect(coreLabels(acc, "en").kindLabels.private_rental).toBe("Private rental");
  });
});
