import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/next";
import { isLocale, withLocale } from "@/lib/i18n/locale";
import { signOut } from "./actions";

export default function AccountPage(props: PageProps<"/[lang]/account">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#faf9f6]" />}>
      <Account params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Account({ params, searchParams }: Pick<PageProps<"/[lang]/account">, "params" | "searchParams">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const to = (path: string) => withLocale(lang, path);
  const confirming = (await searchParams).logout === "1";
  const user = await getCurrentUser();
  if (!user) redirect(to(`/login?next=${encodeURIComponent(to("/account"))}`));

  const email = user.email ?? "";
  const meta = user.user_metadata as { full_name?: string; name?: string } | null;
  const name = meta?.full_name ?? meta?.name ?? (email.split("@")[0] || "ユーザー");
  const how = user.app_metadata?.provider === "google" ? "Google でログイン中" : "メールでログイン中";

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-[#faf9f6] text-[#171717]">
      <div className="flex h-14 items-center gap-1 px-2">
        <Link href={to("/")} aria-label="戻る" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="m-0 text-base font-semibold">アカウント</h1>
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
          href={to("/account?logout=1")}
          className="mt-auto flex h-[52px] items-center justify-center rounded-[26px] border border-[#d6d3cb] bg-white text-[15px] font-medium text-[#a1361f] no-underline"
        >
          ログアウト
        </Link>
      </div>

      {confirming && (
        <>
          <Link href={to("/account")} aria-label="閉じる" className="absolute inset-0 z-10 bg-black/45" />
          <section
            role="dialog"
            aria-labelledby="logout-title"
            className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-[18px] rounded-t-3xl bg-white px-6 pb-7 pt-2.5"
          >
            <div className="flex justify-center">
              <span className="h-[5px] w-10 rounded-[3px] bg-[#d6d3cb]" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 id="logout-title" className="m-0 text-lg font-bold leading-snug">ログアウトしますか</h2>
              <p className="m-0 text-[13px] leading-[1.7] text-[#55524a]">
                保存したスポットと My Tour はアカウントに残ります。共有したリンクはログアウトしても見られます。
              </p>
            </div>
            <form action={signOut} className="flex">
              <input type="hidden" name="lang" value={lang} />
              <button type="submit" className="h-[52px] flex-1 rounded-[26px] border-0 bg-[#a1361f] text-[15px] font-medium text-white">
                ログアウト
              </button>
            </form>
            <Link
              href={to("/account")}
              className="flex h-[52px] items-center justify-center rounded-[26px] border border-[#d6d3cb] text-[15px] font-medium text-[#171717] no-underline"
            >
              キャンセル
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
