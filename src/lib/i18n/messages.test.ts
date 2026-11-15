import { describe, expect, it } from "vitest";
import { messages } from "./messages";

// 文言（関数は見本の引数で呼ぶ）を平たく並べる
function texts(o: unknown): string[] {
  if (typeof o === "string") return [o];
  if (typeof o === "function") return [String(o("X", "Y"))];
  return Object.values(o as Record<string, unknown>).flatMap(texts);
}

describe("messages", () => {
  it("en に日本語が残っていない", () => {
    const left = texts(messages("en")).filter((s) => /[ぁ-んァ-ン一-龥]/.test(s));
    expect(left).toEqual([]);
  });

  it("ja と en は同じキーを持つ", () => {
    const keys = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v).map((x) => `${k}.${x}`) : [k]));
    expect(keys(messages("en"))).toEqual(keys(messages("ja")));
  });
});
