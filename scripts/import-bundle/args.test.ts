import { describe, expect, it } from "vitest";
import { parseArgs } from "./args.ts";

describe("parseArgs", () => {
  it("既定は 1 つずつ", () => {
    expect(parseArgs(["b.json"])).toEqual({ ok: true, value: { file: "b.json", dryRun: false, parallel: 1 } });
  });

  it("--parallel は 6、--parallel=N は N", () => {
    expect(parseArgs(["b.json", "--parallel"])).toMatchObject({ ok: true, value: { parallel: 6 } });
    expect(parseArgs(["--parallel=10", "b.json", "--dry-run"])).toEqual({ ok: true, value: { file: "b.json", dryRun: true, parallel: 10 } });
  });

  it("範囲外・数でない N と、知らないオプションは失敗", () => {
    for (const a of ["--parallel=0", "--parallel=17", "--parallel=x", "--parallel=2.5", "--paralel"]) {
      expect(parseArgs(["b.json", a]).ok).toBe(false);
    }
  });
});
