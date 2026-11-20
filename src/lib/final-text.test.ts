import { describe, expect, it } from "vitest";
import { isUsableFinal, parseFinal } from "./final-text";

const text = `【箱根・温泉（2 人・11 月）　1 泊 2 日の案】

■ 泊まる：koti hakone（一棟貸し・箱根・仙石原）
仙石原の一棟貸し。
・料金 262,000〜389,500（1 棟 1 泊・税込（円））
・行き方 箱根湯本駅から バス 30分
・予約（公式） https://vacation-koti.jp/plan
・予約（楽天トラベル） https://hotel.travel.rakuten.co.jp/hotelinfo/plan/123

■ 過ごす：仙石原すすき草原（高原・箱根・仙石原）
・地図 https://www.google.com/maps/search/?api=1&query=35.26,139.00

— WANDRARA で作った案です
要確認：koti hakone の 11 月の空き`;

describe("parseFinal", () => {
  it("見出し・場所ごとの予約リンク・要確認を読む", () => {
    const p = parseFinal(text);
    expect(p.heading).toBe("【箱根・温泉（2 人・11 月）　1 泊 2 日の案】");
    expect(p.places.map((x) => [x.role, x.title])).toEqual([
      ["泊まる", "koti hakone"],
      ["過ごす", "仙石原すすき草原"],
    ]);
    expect(p.places[0].bookings).toEqual([
      { label: "公式", url: "https://vacation-koti.jp/plan" },
      { label: "楽天トラベル", url: "https://hotel.travel.rakuten.co.jp/hotelinfo/plan/123" },
    ]);
    expect(p.places[1].bookings).toEqual([]); // 地図は予約ではない
    expect(p.checks).toEqual(["koti hakone の 11 月の空き"]);
    expect(isUsableFinal(p)).toBe(true);
  });
  it("形が崩れた文・関係ない文は、場所なし", () => {
    expect(isUsableFinal(parseFinal("こんにちは。よろしく"))).toBe(false);
    expect(parseFinal("").places).toEqual([]);
  });
  it("英語の行と、ラベルの無い予約", () => {
    const p = parseFinal("[Hakone]\n\n■ Stay: koti hakone (Villa · Hakone)\n- Book (Rakuten Travel) https://r.example/1\n- Book https://b.example/2\nTo check: availability");
    expect(p.places[0]).toMatchObject({ role: "Stay", title: "koti hakone", bookings: [{ label: "Rakuten Travel", url: "https://r.example/1" }, { label: "", url: "https://b.example/2" }] });
    expect(p.checks).toEqual(["availability"]);
  });
});
