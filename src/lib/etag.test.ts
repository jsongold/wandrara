import { describe, expect, it } from "vitest";
import { etagOf, matchesEtag } from "./etag";

describe("etagOf", () => {
  it("同じ本文は同じ値、違う本文は違う値。引用符つきの強い ETag", () => {
    expect(etagOf("a")).toBe(etagOf("a"));
    expect(etagOf("a")).not.toBe(etagOf("b"));
    expect(etagOf("a")).toMatch(/^"[A-Za-z0-9_-]{22}"$/);
  });
});

describe("matchesEtag", () => {
  const e = etagOf("body");
  it("一致・weak 表記・複数・* は true", () => {
    expect(matchesEtag(e, e)).toBe(true);
    expect(matchesEtag(`W/${e}`, e)).toBe(true);
    expect(matchesEtag(`"x", ${e}`, e)).toBe(true);
    expect(matchesEtag("*", e)).toBe(true);
  });
  it("ヘッダ無し・不一致は false", () => {
    expect(matchesEtag(null, e)).toBe(false);
    expect(matchesEtag("", e)).toBe(false);
    expect(matchesEtag('"other"', e)).toBe(false);
  });
});
