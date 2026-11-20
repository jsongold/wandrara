import { describe, expect, it } from "vitest";
import { parseReactions, react } from "./reactions";

describe("react", () => {
  it("付ける・置き換える・同じものでは外す", () => {
    const a = react({}, "d1", "good");
    expect(a).toEqual({ d1: "good" });
    const b = react(a, "d1", "great");
    expect(b).toEqual({ d1: "great" });
    expect(react(b, "d1", "great")).toEqual({});
  });
  it("ほかの場所のリアクションは残す", () => {
    expect(react({ d1: "hmm" }, "d2", "good")).toEqual({ d1: "hmm", d2: "good" });
  });
});

describe("parseReactions", () => {
  it("知らない値・壊れた文字列は捨てる", () => {
    expect(parseReactions('{"d1":"good","d2":"wow","d3":1}')).toEqual({ d1: "good" });
    expect(parseReactions("{")).toEqual({});
    expect(parseReactions("[1]")).toEqual({});
    expect(parseReactions(null)).toEqual({});
  });
});
