import { describe, expect, it } from "vitest";
import { labelOf, type Term } from "./accommodation.ts";
import * as bld from "./building.ts";
import * as hot from "./hotspring.ts";
import * as vil from "./village.ts";
import { BATH_GENDER_LIST as ACC_GENDERS, BATH_KIND_LIST as ACC_BATHS } from "./accommodation.ts";

const lists = [...Object.entries(bld), ...Object.entries(hot), ...Object.entries(vil)].filter(([n, v]) => n.endsWith("_LIST") && Array.isArray(v)) as [string, readonly Term[]][];

describe("建物・日帰り温泉・まちの語彙", () => {
  it("どの一覧もコードが重ならず、ja と en の表示名がある（en に日本語が混ざらない）", () => {
    expect(lists.length).toBeGreaterThanOrEqual(8);
    for (const [name, list] of lists) {
      expect(new Set(list.map((t) => t.code)).size, name).toBe(list.length);
      for (const t of list) {
        expect(t.label, `${name}.${t.code}`).not.toBe("");
        expect(t.en, `${name}.${t.code}`).not.toBe("");
        expect(t.en, `${name}.${t.code}`).not.toMatch(/[ぁ-んァ-ン一-龥]/);
      }
    }
  });

  it("風呂の種類・男女は宿の語彙の一部（コードも表示名も同じ）", () => {
    // 足湯（foot）は日帰り温泉だけ。それ以外は宿と同じコード・表示名
    for (const t of hot.BATH_KIND_LIST.filter((x) => x.code !== "foot")) expect(ACC_BATHS.find((a) => a.code === t.code), t.code).toMatchObject({ en: t.en });
    expect(hot.BATH_KINDS).toContain("foot");
    for (const t of hot.BATH_GENDER_LIST) expect(ACC_GENDERS.find((a) => a.code === t.code), t.code).toMatchObject({ label: t.label, en: t.en });
    expect(hot.BATH_KINDS).toContain("sauna");
  });

  it("labelOf は ja・en を返す", () => {
    expect(labelOf(hot.TOWEL_LIST, "rental")).toBe("貸し出し");
    expect(labelOf(hot.TOWEL_LIST, "rental", "en")).toBe("Rental");
    expect(labelOf(bld.AUDIENCE_LIST, "adult", "en")).toBe("Adults");
  });
});
