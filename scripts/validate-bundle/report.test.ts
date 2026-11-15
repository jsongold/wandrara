import { describe, expect, it } from "vitest";
import { formatReport, groupByDest } from "./report.ts";

const raw = [
  { core_type: "accommodation", ref: "WR-a-001" },
  { core_type: "nature", slug: "lake" },
  { core_type: "building" },
];

describe("groupByDest", () => {
  it("/dests/<i> のエラーをその dest に、それ以外を bundle に分ける", () => {
    const r = groupByDest(
      ["/dests/0/details/prices 料金が要る", "/dests/0/core/lat 座標が要る", "/dests/2 写真が読めない", "/collector Required"],
      raw,
    );
    expect(r.bundle).toEqual(["/collector Required"]);
    expect(r.dests.map((d) => [d.label, d.errors])).toEqual([
      ["WR-a-001", ["/details/prices 料金が要る", "/core/lat 座標が要る"]],
      ["lake", []],
      ["(dests[2])", ["/ 写真が読めない"]],
    ]);
  });
});

describe("formatReport", () => {
  it("OK は 1 行、NG は理由を字下げ、最後に件数", () => {
    const text = formatReport(groupByDest(["/dests/0/core/lat 座標が要る"], raw));
    expect(text.split("\n")).toEqual([
      "NG  WR-a-001 (accommodation)",
      "      /core/lat 座標が要る",
      "OK  lake (nature)",
      "OK  (dests[2]) (building)",
      "3 件中 2 件 OK",
    ]);
  });
});
