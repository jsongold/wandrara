import { describe, expect, it } from "vitest";
import { finalFileName, makeFinal } from "./final";
import { parseFinal } from "./final-text";

describe("final", () => {
  it("完成版から確定したものを作り、予約リンクのサイトを決める", () => {
    const text = "【箱根（2 人）】\n\n■ 泊まる：宿（宿・箱根）\n・予約（公式） https://o.example\n・予約（楽天トラベル） https://travel.rakuten.co.jp/HOTEL/1/";
    const f = makeFinal(text, parseFinal(text), "2 人", "id1", new Date("2026-11-20T00:00:00Z"));
    expect(f.items[0].bookings.map((b) => b.site)).toEqual(["official", "rakuten"]);
    expect(finalFileName(f)).toBe("wandrara-箱根-2-人-2026-11-20.txt");
  });
});

describe("finalFromRaw", async () => {
  const { finalFromRaw } = await import("./final-store");
  it("保存した文字列から 1 件を取り出す。壊れた・無いものは null", () => {
    expect(finalFromRaw(JSON.stringify({ a: { id: "a" } }), "a")).toEqual({ id: "a" });
    expect(finalFromRaw("{", "a")).toBeNull();
    expect(finalFromRaw(null, "a")).toBeNull();
  });
});
