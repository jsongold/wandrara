// 詳細は地域名の解決に全件の Catalog を読まず、地域だけを読む（MS1b）。
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Region } from "./types";

const { getRegions, getCatalog } = vi.hoisted(() => ({
  getRegions: vi.fn(),
  getCatalog: vi.fn(async () => {
    throw new Error("詳細は全件の Catalog を読まない");
  }),
}));

vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));
vi.mock("./data", () => ({ getRegions, getCatalog, photoUrl: (base: string, key: string) => `${base}/${key}` }));

// Supabase の代わり。destinations は宿 1 件、コアの行は region_id だけ、ほかは空
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const single =
        table === "destinations" ? { dest_id: "d1", core_type: "accommodation", is_demo: false } : table === "accommodations" ? { region_id: "gora" } : null;
      const list = table === "accommodation_texts" ? [{ lang: "ja", name: "強羅の宿", summary: null }] : [];
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        order: () => q,
        maybeSingle: async () => ({ data: single, error: null }),
        then: (res: (v: unknown) => unknown) => res({ data: list, error: null }),
      };
      return q;
    },
  }),
}));

const regions: Region[] = [
  { id: "hakone", parentId: null, name: { ja: "箱根", en: "Hakone" }, sort: 1 },
  { id: "gora", parentId: "hakone", name: { ja: "強羅", en: "Gora" }, sort: 1 },
];

describe("getDestDetail の地域名", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "key");
    getRegions.mockReset().mockResolvedValue(regions);
    getCatalog.mockClear();
  });

  it("getRegions だけで「親・地区」の名前になり、getCatalog は呼ばない", async () => {
    const { getDestDetail } = await import("./detail");
    expect((await getDestDetail("gora-inn", "ja"))?.areaLabel).toBe("箱根・強羅");
    expect((await getDestDetail("gora-inn", "en"))?.areaLabel).toBe("Hakone・Gora");
    expect(getRegions).toHaveBeenCalled();
    expect(getCatalog).not.toHaveBeenCalled();
  });
});
