import { describe, expect, it, vi } from "vitest";

vi.mock("./data", () => ({ env: () => ({ url: "https://x" }), photoUrl: (base: string, key: string) => `${base}/${key}`, supabase: vi.fn() }));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const { presetViews } = await import("./suggest-presets");

const rows = [
  { slug: "a", name: { ja: "仙石原すすき草原" }, photos: [{ storage_key: "a0" }, { storage_key: "a1" }] },
  { slug: "b", name: { ja: "仙石原温泉" }, photos: [{ storage_key: "b0" }] },
];

describe("presetViews", () => {
  it("1 つ目の代表の場所の指定の写真を表紙にし、場所の名前を並べる", () => {
    const v = presetViews([{ id: "p", text: "", keywords: [], examples: [{ slug: "a", photo: 1 }, { slug: "b" }] }], rows, "ja", "https://x");
    expect(v.p).toEqual({ cover: "https://x/a1", places: ["仙石原すすき草原", "仙石原温泉"] });
  });
  it("写真の番号が無ければ 1 枚目。見つからない slug は飛ばす", () => {
    const v = presetViews([{ id: "p", text: "", keywords: [], examples: [{ slug: "zz" }, { slug: "b", photo: 9 }] }], rows, "ja", "https://x");
    expect(v.p).toEqual({ cover: "https://x/b0", places: ["仙石原温泉"] });
  });
  it("どれも見つからなければ表紙なし", () => {
    const v = presetViews([{ id: "p", text: "", keywords: [], examples: [{ slug: "zz" }] }], rows, "ja", "https://x");
    expect(v.p).toEqual({ cover: null, places: [] });
  });
});
