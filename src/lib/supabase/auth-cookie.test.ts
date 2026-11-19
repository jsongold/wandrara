import { describe, expect, it } from "vitest";
import { hasAuthCookie } from "./auth-cookie";

describe("hasAuthCookie", () => {
  it("cookie が無ければ false", () => {
    expect(hasAuthCookie("")).toBe(false);
    expect(hasAuthCookie("NEXT_LOCALE=ja; theme=dark")).toBe(false);
  });
  it("セッションの cookie があれば true（先頭・途中・末尾）", () => {
    expect(hasAuthCookie("sb-abc-auth-token=base64-xxx")).toBe(true);
    expect(hasAuthCookie("NEXT_LOCALE=ja; sb-abc-auth-token=base64-xxx; a=b")).toBe(true);
    expect(hasAuthCookie("a=b; sb-abc-auth-token=x")).toBe(true);
  });
  it("分割された cookie（.0, .1）でも true", () => {
    expect(hasAuthCookie("a=b; sb-abc-auth-token.0=xxx; sb-abc-auth-token.1=yyy")).toBe(true);
    expect(hasAuthCookie("sb-abc-auth-token.1=yyy")).toBe(true);
  });
  it("ログイン途中の code-verifier だけでは false", () => {
    expect(hasAuthCookie("sb-abc-auth-token-code-verifier=xxx")).toBe(false);
  });
  it("名前の途中に含まれるだけの別 cookie は false", () => {
    expect(hasAuthCookie("x-sb-abc-auth-token=1")).toBe(false);
    expect(hasAuthCookie("sb-abc-auth-token-other=1")).toBe(false);
  });
});
