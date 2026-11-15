import { describe, expect, it } from "vitest";
import { contentHash } from "./hash.ts";
import type { DestInput } from "./bundle.ts";

const base = (): DestInput => ({
  ref: "WR-x-001",
  core: { kind: "private_rental", region_id: "atami" },
  texts: [{ lang: "ja", name: "ヴィラ" }],
  photos: [{ storage_key: "a.jpg" }, { storage_key: "b.jpg" }],
});

describe("contentHash", () => {
  it("キーの順が違っても同じ", () => {
    const a = base();
    const b = { texts: a.texts, core: { region_id: "atami", kind: "private_rental" }, ref: "WR-x-001", photos: a.photos };
    expect(contentHash(b as DestInput)).toBe(contentHash(a));
  });

  it("sources・verification_status は見ない", () => {
    const b = { ...base(), sources: [{ url: "https://example.com/", retrieved_at: "2026-11-15" }], verification_status: "verified" };
    expect(contentHash(b)).toBe(contentHash(base()));
  });

  it("details.sources は details 列に入るので見る（いちばん上の sources とは別）", () => {
    const src = (retrieved_at: string) => ({ details: { sources: [{ name: "公式", url: "https://example.com/", type: "official", retrieved_at }] } });
    const a = { ...base(), ...src("2026-11-15") };
    expect(contentHash({ ...base(), ...src("2026-11-16") })).not.toBe(contentHash(a));
    expect(contentHash({ ...a, sources: [{ url: "https://example.com/" }] })).toBe(contentHash(a));
  });

  it("中身が変わると変わる", () => {
    const b = base();
    b.texts = [{ lang: "ja", name: "ヴィラ2" }];
    expect(contentHash(b)).not.toBe(contentHash(base()));
  });

  it("配列の順が変わると変わる（写真の並び）", () => {
    const b = base();
    b.photos = [...b.photos!].reverse();
    expect(contentHash(b)).not.toBe(contentHash(base()));
  });

  it("版の接頭辞つき", () => {
    expect(contentHash(base())).toMatch(/^v1:[0-9a-f]{64}$/);
  });
});
