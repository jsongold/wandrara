import { describe, expect, it } from "vitest";
import { localeOfPath, matchAcceptLanguage, pickLocale, switchLocale, withLocale } from "./locale";

describe("matchAcceptLanguage", () => {
  it("q の高い順に、対応する言語を選ぶ", () => {
    expect(matchAcceptLanguage("en-US,en;q=0.9,ja;q=0.8")).toBe("en");
    expect(matchAcceptLanguage("fr-FR,fr;q=0.9,ja;q=0.8,en;q=0.7")).toBe("ja");
    expect(matchAcceptLanguage("en;q=0.5,ja")).toBe("ja");
  });

  it("対応する言語が無い・q=0・空なら null", () => {
    expect(matchAcceptLanguage("fr,de")).toBeNull();
    expect(matchAcceptLanguage("en;q=0")).toBeNull();
    expect(matchAcceptLanguage("")).toBeNull();
    expect(matchAcceptLanguage(null)).toBeNull();
  });
});

describe("pickLocale", () => {
  it("本人が選んだ言語（cookie）> 端末の言語 > ja", () => {
    expect(pickLocale("ja", "en-US")).toBe("ja");
    expect(pickLocale(undefined, "en-US")).toBe("en");
    expect(pickLocale("xx", "en-US")).toBe("en");
    expect(pickLocale(undefined, "fr")).toBe("ja");
  });
});

describe("パスの言語", () => {
  it("先頭の言語を読む", () => {
    expect(localeOfPath("/en/d/x")).toBe("en");
    expect(localeOfPath("/ja")).toBe("ja");
    expect(localeOfPath("/en?mode=do")).toBe("en");
    expect(localeOfPath("/end")).toBeNull();
    expect(localeOfPath("/d/x")).toBeNull();
  });

  it("言語を付ける", () => {
    expect(withLocale("en", "/")).toBe("/en");
    expect(withLocale("en", "/?mode=do")).toBe("/en?mode=do");
    expect(withLocale("ja", "/d/x")).toBe("/ja/d/x");
  });

  it("言語を付け替える（無ければ付ける）", () => {
    expect(switchLocale("/ja/d/x", "en")).toBe("/en/d/x");
    expect(switchLocale("/ja", "en")).toBe("/en");
    expect(switchLocale("/ja?mode=do", "en")).toBe("/en?mode=do");
    expect(switchLocale("/d/x", "en")).toBe("/en/d/x");
  });
});
