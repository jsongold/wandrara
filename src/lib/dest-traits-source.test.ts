import { describe, expect, it } from "vitest";
import { destTraitsOf } from "./dest-traits-source";

describe("destTraitsOf", () => {
  it("値の付いた dest だけを dest_id → 特徴 id にする", () => {
    expect(destTraitsOf({ dests: [{ destId: "a", accepted: [{ traitId: "sauna" }, { traitId: "quiet" }] }, { destId: "b", accepted: [] }] })).toEqual({ a: ["sauna", "quiet"] });
  });
});
