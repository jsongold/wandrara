import { describe, expect, it } from "vitest";
import { formatFactValue, planImport, slugify, type Bundle, type BundleSpot, type Refs } from "./plan";
import { sniffImage, uploadPhotos } from "./photo";
import { quoteLiteral, renderSql } from "./sql";

const refs = (spots: [string, string | null][] = []): Refs => ({
  areas: new Set(["hakone", "sengokuhara"]),
  categories: new Set(["stay", "plateau"]),
  spots: new Map(spots),
});

const src = { type: "official", name: "公式サイト", url: "https://example.com/", retrieved_at: "2026-11-13" };

const spot = (over: Partial<BundleSpot> = {}): BundleSpot => ({
  external_ref: "CHAT-002",
  kind: "stay",
  name: { ja: "テストの宿" },
  location: { prefecture: "神奈川県", municipality: "箱根町", area_id: "sengokuhara" },
  categories: ["stay", "plateau"],
  verification_status: "collected",
  ...over,
});

const bundle = (...spots: BundleSpot[]): Bundle => ({ bundle_version: "1", collected_at: "2026-11-14T00:00:00Z", collector: "test", spots });

describe("planImport", () => {
  it("新しいスポットは external_ref から slug を作り、公開しない値は持たない", () => {
    const plan = planImport(bundle(spot()), refs());
    expect(plan.errors).toEqual([]);
    expect(plan.spots.map((s) => s.id)).toEqual(["chat-002"]);
    expect(plan.categories).toEqual([{ spot_id: "chat-002", category_id: "stay" }, { spot_id: "chat-002", category_id: "plateau" }]);
  });

  it("入れ直しでは既存の id を使い、slug を変えない", () => {
    const plan = planImport(bundle(spot({ slug: "new-slug" })), refs([["coco-villa", "CHAT-002"]]));
    expect(plan.spots[0].id).toBe("coco-villa");
  });

  it("別のスポットの id と重なる slug は取り込まない", () => {
    const plan = planImport(bundle(spot({ slug: "lakeside-stay" })), refs([["lakeside-stay", null]]));
    expect(plan.errors[0]).toContain("lakeside-stay");
    expect(plan.spots).toEqual([]);
  });

  it("候補は公開せず原本だけ残し、公開済みなら取り下げる", () => {
    const plan = planImport(bundle(spot({ verification_status: "candidate", location: { prefecture: "長野県", municipality: "白馬村" } })), refs([["chat-002", "CHAT-002"]]));
    expect(plan.errors).toEqual([]);
    expect(plan.spots).toEqual([]);
    expect(plan.records[0].spot_id).toBeNull();
    expect(plan.removeRefs).toEqual(["CHAT-002"]);
  });

  it("エリアは制限にしない：無い ID は市町村名で作り、ID が無ければエリア無しで入れる", () => {
    const plan = planImport(bundle(
      spot({ external_ref: "A", location: { prefecture: "静岡県", municipality: "熱海市", area_id: "atami" } }),
      spot({ external_ref: "B", location: { prefecture: "静岡県", municipality: "熱海市", area_id: "atami" } }),
      spot({ external_ref: "C", location: { prefecture: "静岡県", municipality: "伊東市" } }),
    ), refs());
    expect(plan.errors).toEqual([]);
    expect(plan.areas).toEqual([{ id: "atami", parent_id: null, name: { ja: "熱海市", en: "atami" }, sort: 1000, overwrite: false }]);
    expect(plan.spots.map((x) => x.area_id)).toEqual(["atami", "atami", null]);
  });

  it("bundle に書いたエリア・カテゴリは更新対象になり、自動では作らない", () => {
    const b = {
      ...bundle(spot({ location: { prefecture: "静岡県", municipality: "熱海市", area_id: "atami" }, categories: ["stay", "sauna"] })),
      areas: [{ id: "atami", parent_id: "izu", name: { ja: "熱海" } }],
      categories: [{ id: "sauna", mode: "experience" as const, name: { ja: "サウナ" }, icon: "flame" }],
    };
    const plan = planImport(b, { ...refs(), areas: new Set(["izu"]) });
    expect(plan.errors).toEqual([]);
    expect(plan.areas).toEqual([{ id: "atami", parent_id: "izu", name: { ja: "熱海" }, sort: 1000, overwrite: true }]);
    expect(plan.categoryDefs).toMatchObject([{ id: "sauna", mode: "experience", icon: "flame", overwrite: true }]);
  });

  it("bundle のエリアの親が無ければエラー", () => {
    const b = { ...bundle(spot()), areas: [{ id: "atami", parent_id: "nowhere", name: { ja: "熱海" } }] };
    expect(planImport(b, refs()).errors[0]).toContain("nowhere");
  });

  it("無いカテゴリは new: を外して作る。種類が体験なら体験のカテゴリにする", () => {
    const plan = planImport(bundle(
      spot({ categories: ["stay", "new:sauna", "sauna"] }),
      spot({ external_ref: "X", kind: "experience", categories: ["sup"] }),
    ), refs());
    expect(plan.errors).toEqual([]);
    expect(plan.categoryDefs.map((c) => [c.id, c.mode, c.overwrite])).toEqual([["sauna", "place", false], ["sup", "experience", false]]);
    expect(plan.categories.filter((c) => c.spot_id === "chat-002").map((c) => c.category_id)).toEqual(["stay", "sauna"]);
  });

  it("事実は表示用の文にし、先頭の出典を表示用に持つ。conflict は未確認として詳細に書く", () => {
    const plan = planImport(bundle(spot({ facts: [
      { key: "max_guests", value: 10, unit: "person", status: "verified", sources: [src] },
      { key: "wifi", status: "unknown" },
      { key: "parking_spaces", value: 3, unit: "car", status: "conflict", sources: [src, { type: "ota", retrieved_at: "2026-11-12" }] },
    ] })), refs());
    const [guests, wifi, parking] = plan.facts;
    expect(guests).toMatchObject({ label: { ja: "定員" }, value: { ja: "10人" }, status: "verified", source_name: "公式サイト", checked_at: "2026-11-13" });
    expect(wifi).toMatchObject({ value: null, status: "unknown", source_name: null });
    expect(parking.status).toBe("unverified");
    expect(parking.detail?.ja).toContain("食い違");
    expect(parking.sources).toHaveLength(2);
  });

  it("写真は権利を問わず取り込む。url / file が無いものだけ外す", () => {
    const plan = planImport(bundle(spot({ photos: [
      { source_page_url: "https://example.com/g", license: "none" },
      { url: "https://example.com/a.jpg", source_page_url: "https://example.com/g", license: "none" },
      { file: "images/b.jpg", source_page_url: "https://example.com/g", license: "cc_by", credit: "A" },
    ] })), refs(), { imageFiles: ["images/z.jpg"] });
    expect(plan.photos.map((p) => [p.src, p.sort])).toEqual([[{ url: "https://example.com/a.jpg" }, 0], [{ file: "images/b.jpg" }, 1]]);
  });

  it("spot が 1 件で写真の指定が無ければ images/ を名前順に使う。2 件以上なら使わない", () => {
    const one = planImport(
      bundle(spot({ photos: [{ source_page_url: "https://example.com/g", license: "none" }] })),
      refs(),
      { imageFiles: ["images/002.jpg", "images/001.jpg"] },
    );
    expect(one.photos.map((p) => [p.src, p.sort, p.source_page_url])).toEqual([
      [{ file: "images/001.jpg" }, 0, "https://example.com/g"],
      [{ file: "images/002.jpg" }, 1, "https://example.com/g"],
    ]);
    const two = planImport(bundle(spot(), spot({ external_ref: "X" })), refs(), { imageFiles: ["images/001.jpg"] });
    expect(two.photos).toEqual([]);
  });
});

describe("formatFactValue", () => {
  it("型ごとに日英の文にする", () => {
    expect(formatFactValue("wifi", true)).toEqual({ ja: "あり", en: "Yes" });
    expect(formatFactValue("bath_types", ["onsen", "private"])).toEqual({ ja: "温泉、貸切風呂", en: "Hot spring, Private bath" });
    expect(formatFactValue("season_months", [7, 8])).toEqual({ ja: "7月、8月", en: "7, 8" });
    expect(formatFactValue("kitchen", { ja: "あり（IH）" })).toEqual({ ja: "あり（IH）", en: undefined });
  });
});

describe("slugify", () => {
  it("英小文字・数字・ハイフンにする", () => expect(slugify("IZU_Villa 03")).toBe("izu-villa-03"));
});

describe("photos", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);

  it("先頭バイトで画像の種類を決める", () => {
    expect(sniffImage(png)?.type).toBe("image/png");
    expect(sniffImage(new TextEncoder().encode("<html>"))).toBeNull();
  });

  it("中身のハッシュのパスに置き、公開 URL と元の URL を持つ。画像でなければ外す", async () => {
    const uploaded: string[] = [];
    const base = { spot_id: "s", license: "cc0", credit: "A", source_page_url: "https://example.com/g", alt: null };
    const { rows, errors } = await uploadPhotos(
      [{ ...base, sort: 0, src: { url: "https://example.com/a.png" } }, { ...base, sort: 1, src: { file: "x.png" } }],
      "/b",
      {
        download: async () => png,
        readFile: async () => new TextEncoder().encode("<html>"),
        upload: async (_b, path) => { uploaded.push(path); },
        publicUrl: (p) => `https://cdn/${p}`,
      },
    );
    expect(uploaded).toEqual([expect.stringMatching(/^spots\/s\/[0-9a-f]{16}\.png$/)]);
    expect(rows).toMatchObject([{ url: `https://cdn/${uploaded[0]}`, original_url: "https://example.com/a.png" }]);
    expect(errors[0]).toContain("x.png");
  });
});

describe("renderSql", () => {
  it("データは 1 つのリテラルに入り、シングルクォートはエスケープされる", () => {
    const plan = planImport(bundle(spot({ name: { ja: "O'Hara's 宿" } })), refs());
    const sql = renderSql(plan, []);
    expect(sql.startsWith("begin;")).toBe(true);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    expect(sql).toContain("O''Hara''s");
    expect(quoteLiteral("a'b")).toBe("'a''b'");
  });
});
