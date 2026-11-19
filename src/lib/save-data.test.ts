import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { cookieSaveData, imageQuality, isSaveDataHeader, readSaveData, saveDataCookie, saveDataOfRequest } from "./save-data";

describe("Save-Data", () => {
  it("リクエストヘッダは on のときだけ有効", () => {
    expect(isSaveDataHeader("on")).toBe(true);
    expect(isSaveDataHeader(" ON ")).toBe(true);
    expect(isSaveDataHeader("off")).toBe(false);
    expect(isSaveDataHeader("")).toBe(false);
    expect(isSaveDataHeader(null)).toBe(false);
  });

  it("サーバーはヘッダか cookie のどちらかで抑える", () => {
    expect(saveDataOfRequest("on", undefined)).toBe(true);
    expect(saveDataOfRequest(null, "1")).toBe(true);
    expect(saveDataOfRequest(null, "0")).toBe(false);
    expect(saveDataOfRequest(null, undefined)).toBe(false);
  });

  it("クライアントは navigator.connection.saveData か cookie（connection が無い Safari・Firefox も）", () => {
    expect(readSaveData({ connection: { saveData: true }, cookie: "" })).toBe(true);
    expect(readSaveData({ connection: { saveData: false }, cookie: "" })).toBe(false);
    expect(readSaveData({ connection: undefined, cookie: "a=1; savedata=1; b=2" })).toBe(true);
    expect(readSaveData({ connection: undefined, cookie: "savedata=1" })).toBe(true);
    expect(readSaveData({ connection: undefined, cookie: "savedata=0; x=savedata=1" })).toBe(false);
    expect(readSaveData({ connection: undefined, cookie: "mysavedata=1" })).toBe(false);
  });

  it("スイッチは本人の cookie だけを読む（ブラウザの設定とは別）", () => {
    expect(cookieSaveData("savedata=1")).toBe(true);
    expect(cookieSaveData("a=b")).toBe(false);
  });

  it("cookie は付ける・消すの 2 通り", () => {
    expect(saveDataCookie(true)).toMatch(/^savedata=1; path=\/; max-age=\d+/);
    expect(saveDataCookie(false)).toMatch(/^savedata=; path=\/; max-age=0/);
  });

  it("写真の画質は next.config.ts の images.qualities に載っている（載っていないと近い値に丸められ、画質の意図が変わる）。形式は AVIF が先", () => {
    expect(nextConfig.images?.qualities).toEqual(expect.arrayContaining([imageQuality(false), imageQuality(true)]));
    expect(imageQuality(true)).toBeLessThan(imageQuality(false));
    expect(nextConfig.images?.formats).toEqual(["image/avif", "image/webp"]);
  });
});
