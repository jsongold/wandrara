// アカウントの中身。全画面（/account）と、トップから開くシート（@sheet/(.)account）で同じものを出す
import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { LogoutButton } from "@/components/LogoutButton";
import { getCurrentUser } from "@/lib/auth/next";
import { withLocale } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";

export async function AccountView({ lang, variant }: { lang: Locale; variant: "page" | "sheet" }) {
  const to = (path: string) => withLocale(lang, path);
  const m = messages(lang).account;
  const c = messages(lang).common;
  const user = await getCurrentUser();
  if (!user) redirect(to(`/login?next=${encodeURIComponent(to("/account"))}`));

  const email = user.email ?? "";
  const meta = user.user_metadata as { full_name?: string; name?: string } | null;
  const name = meta?.full_name ?? meta?.name ?? (email.split("@")[0] || m.fallbackName);
  const how = user.app_metadata?.provider === "google" ? m.viaGoogle : m.viaEmail;

  return (
    <div className={`relative mx-auto flex ${variant === "page" ? "min-h-dvh" : "min-h-full"} w-full max-w-[480px] flex-col bg-[#faf9f6] text-[#171717]`}>
      <div className={`flex h-14 items-center gap-1 ${variant === "page" ? "px-2" : "px-4 pt-4"}`}>
        {variant === "page" && (<Link href={to("/")} aria-label={c.back} className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>)}
        <h1 className="m-0 text-base font-semibold">{m.title}</h1>
      </div>
      <div className="flex flex-1 flex-col gap-5 px-4 pb-7 pt-2">
        <div className="flex items-center gap-3.5 rounded-2xl bg-white p-4">
          <span className="flex size-[52px] flex-none items-center justify-center rounded-full bg-[#2f2e2a]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="9" r="3.5" />
              <path d="M5 19c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5" />
            </svg>
          </span>
          <div className="flex min-w-0 flex-col gap-[3px]">
            <span data-testid="account-name" className="truncate text-base font-semibold">{name}</span>
            <span data-testid="account-email" className="truncate text-[13px] text-[#55524a]">{email}・{how}</span>
          </div>
        </div>
        <Link
          href={to("/saved")}
          data-testid="saved-link"
          className="flex h-[52px] items-center justify-between rounded-2xl bg-white px-4 text-[15px] font-medium text-[#171717] no-underline"
        >
          {messages(lang).saves.openList}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#55524a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <div className="flex h-[52px] items-center justify-between rounded-2xl bg-white pl-4 pr-1.5 text-[15px] font-medium">
          {m.language}
          <LanguageSwitch locale={lang} className="h-10 min-w-10 cursor-pointer rounded-xl border border-[#d6d3cb] bg-transparent px-3 text-[13px] font-semibold text-[#171717]" />
        </div>
        <LogoutButton lang={lang} />
      </div>

    </div>
  );
}
