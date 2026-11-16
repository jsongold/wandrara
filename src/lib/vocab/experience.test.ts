import { describe, expect, it } from "vitest";
import * as exp from "./experience.ts";
import * as nat from "./nature.ts";
import { labelOf, type Term } from "./accommodation.ts";

const lists = [...Object.entries(exp), ...Object.entries(nat)].filter(([n, v]) => n.endsWith("_LIST") && Array.isArray(v)) as [string, readonly Term[]][];

describe("体験・自然の語彙", () => {
  it("どの一覧もコードが重ならず、ja と en の表示名がある（en に日本語が混ざらない）", () => {
    expect(lists.length).toBeGreaterThanOrEqual(10);
    for (const [name, list] of lists) {
      expect(new Set(list.map((t) => t.code)).size, name).toBe(list.length);
      for (const t of list) {
        expect(t.label, `${name}.${t.code}`).not.toBe("");
        expect(t.en, `${name}.${t.code}`).not.toBe("");
        expect(t.en, `${name}.${t.code}`).not.toMatch(/[ぁ-んァ-ン一-龥]/);
      }
    }
  });

  it("コードの tuple は一覧と同じ並び", () => {
    expect(exp.PRICE_PERS).toEqual(["person", "group", "session"]);
    expect(nat.DIFFICULTIES).toEqual(nat.DIFFICULTY_LIST.map((t) => t.code));
  });

  it("labelOf は ja・en を返し、知らないコードはそのまま", () => {
    expect(labelOf(exp.PRICE_PER_LIST, "group")).toBe("1 グループ");
    expect(labelOf(exp.PRICE_PER_LIST, "group", "en")).toBe("per group");
    expect(labelOf(nat.PROTECTION_LIST, "geopark", "en")).toBe("Geopark");
    expect(labelOf(nat.PROTECTION_LIST, "nope")).toBe("nope");
  });
});
