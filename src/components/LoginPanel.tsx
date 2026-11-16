"use client";

import Link from "next/link";
import { useActionState } from "react";
import { sendMagicLink, type EmailLoginState } from "../app/[lang]/login/actions";
import { withLocale } from "../lib/i18n/locale";
import { messages } from "../lib/i18n/messages";
import { createClient } from "../lib/supabase/client";
import type { Locale } from "../lib/types";
import { LanguageSwitch } from "./LanguageSwitch";

// 当面はメールのリンクだけ。Google は NEXT_PUBLIC_AUTH_GOOGLE=1 のときだけ出す
const GOOGLE = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";
const initial: EmailLoginState = { error: null };

export function LoginPanel({ locale, next, variant = "page" }: { locale: Locale; next: string; variant?: "page" | "sheet" }) {
  const [state, action, pending] = useActionState(sendMagicLink, initial);
  const m = messages(locale).login;

  async function google() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  return (
    <div className={`flex ${variant === "page" ? "min-h-dvh" : "min-h-full"} flex-col bg-[#24231f] text-[#171717]`}>
      <div className={`relative flex ${variant === "page" ? "h-[420px] pt-14" : "h-[200px] pt-12"} flex-col items-center bg-[#3a3832]`}>
        <LanguageSwitch
          locale={locale}
          className="absolute right-4 top-3.5 flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-white/10 px-3 text-[13px] font-semibold text-white"
        />
        <span className="text-[15px] font-semibold tracking-[0.24em] text-white">WANDRARA</span>
        <span className="mt-2.5 text-xs text-[#e7e4dc]">{m.tagline}</span>
      </div>
      <div className="-mt-0 flex flex-1 flex-col gap-5 rounded-t-3xl bg-white px-6 pb-7 pt-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-[22px] font-bold leading-snug">{m.title}</h1>
          <p className="text-[13px] leading-[1.7] text-[#55524a]">
            {m.lead}
          </p>
        </div>
        {GOOGLE && (
          <>
            <button
              type="button"
              onClick={google}
              className="flex h-[52px] items-center justify-center gap-2.5 rounded-[26px] border border-[#d6d3cb] bg-white text-[15px] font-medium"
            >
              <span aria-hidden className="flex size-[22px] items-center justify-center rounded-full border border-[#d6d3cb] text-xs font-semibold">G</span>
              {m.google}
            </button>
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-[#e7e4dc]" />
              <span className="text-xs text-[#6b675e]">{m.or}</span>
              <span className="h-px flex-1 bg-[#e7e4dc]" />
            </div>
          </>
        )}
        <form action={action} className="flex flex-col gap-5">
          <input type="hidden" name="next" value={next} data-testid="login-next" />
          <input type="hidden" name="lang" value={locale} />
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-[13px] font-medium">{m.email}</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="h-12 rounded-xl border border-[#d6d3cb] bg-[#faf9f6] px-3.5 text-[15px]"
            />
            {state.error && <p role="alert" className="text-xs text-[#b3261e]">{state.error}</p>}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="h-[52px] rounded-[26px] bg-[#171717] text-[15px] font-medium text-white disabled:opacity-60"
          >
            {m.send}
          </button>
        </form>
        <div className="mt-auto flex flex-col items-center gap-2.5">
          <Link href={withLocale(locale, "/")} className="text-sm font-medium">{m.guest}</Link>
          <p className="text-center text-[11px] leading-relaxed text-[#6b675e]">
            {m.terms}
          </p>
        </div>
      </div>
    </div>
  );
}
