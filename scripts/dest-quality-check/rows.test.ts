import { describe, expect, it } from "vitest";
import { buildQualityRows, latestPayloads, NO_IMPORT, summarize } from "./rows.ts";

const good = {
  core: { region_id: "atami", lat: 35.1, lng: 139.07 },
  texts: [{ lang: "ja", name: "N", summary: "S" }],
  details: { access: [{ note: "徒歩" }] },
  photos: [{ storage_key: "a.jpg" }],
  sources: [{ url: "https://example.com/" }],
};

describe("latestPayloads", () => {
  it("新しい順の最初の 1 つを取り、dest_id の無いものは飛ばす", () => {
    const m = latestPayloads([
      { dest_id: "a", payload: "new" },
      { dest_id: null, payload: "x" },
      { dest_id: "a", payload: "old" },
      { dest_id: "b", payload: "b1" },
    ]);
    expect([...m]).toEqual([["a", "new"], ["b", "b1"]]);
  });
});

describe("buildQualityRows", () => {
  it("全部満たせば 100・issues 空、欠ければ割合と理由、投入が無ければ 0", () => {
    const dests = [
      { dest_id: "a", core_type: "nature" },
      { dest_id: "b", core_type: "nature" },
      { dest_id: "c", core_type: "village" },
    ];
    const bad = { ...good, photos: [] };
    const rows = buildQualityRows(dests, new Map<string, unknown>([["a", good], ["b", bad]]));
    expect(rows[0]).toEqual({ dest_id: "a", quality: 100, reason: { version: "v1", issues: [] } });
    expect(rows[1].quality).toBe(83); // nature の決まり 6 つのうち 5 つ
    expect(rows[1].reason.issues).toEqual([{ path: "/photos", message: "写真が 1 枚以上要る" }]);
    expect(rows[2]).toEqual({ dest_id: "c", quality: 0, reason: { version: "v1", issues: [NO_IMPORT] } });
    expect(summarize(dests, rows)).toEqual(["nature: 2 件・全部満たす 1 件・quality 平均 92", "village: 1 件・全部満たす 0 件・quality 平均 0"]);
  });
});
