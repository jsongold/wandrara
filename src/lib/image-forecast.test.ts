import { describe, expect, it } from "vitest";
import { forecast, hobbyLimitPhotos } from "./image-forecast";

describe("画像変換の見積もり", () => {
  it("約 1,100 枚で月 3,300 件・Hobby の 66%（MS1c の見積もりと同じ）", () => {
    const f = forecast(1100);
    expect(f.transforms).toBe(3300);
    expect(f.hobbyShare).toBeCloseTo(0.66, 2);
    expect(f.overHobby).toBe(false);
  });

  it("2 倍で Hobby の上限（5K）を超える。上限は約 1,666 枚", () => {
    expect(forecast(2200).overHobby).toBe(true);
    expect(hobbyLimitPhotos()).toBe(1666);
    expect(forecast(hobbyLimitPhotos()).overHobby).toBe(false);
    expect(forecast(hobbyLimitPhotos() + 1).overHobby).toBe(true);
  });

  it("Pro の費用は 10 倍（33,000 件）でも月 4 ドル未満", () => {
    const f = forecast(11_000);
    expect(f.transforms).toBe(33_000);
    expect(f.proUsd).toBeGreaterThan(3);
    expect(f.proUsd).toBeLessThan(4);
  });
});
