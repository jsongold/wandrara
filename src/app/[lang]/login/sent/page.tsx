import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isLocale, withLocale } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";

export default function SentPage(props: PageProps<"/[lang]/login/sent">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#24231f]" />}>
      <Sent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Sent({ params, searchParams }: Pick<PageProps<"/[lang]/login/sent">, "params" | "searchParams">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const m = messages(lang).login;
  const raw = (await searchParams).email;
  const email = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return (
    <div className="flex min-h-dvh flex-col bg-[#24231f] text-[#171717]">
      <div className="flex h-[420px] justify-center bg-[#3a3832] pt-14">
        <span className="text-[15px] font-semibold tracking-[0.24em] text-white">WANDRARA</span>
      </div>
      <div className="flex flex-1 flex-col items-center gap-5 rounded-t-3xl bg-white px-6 pb-7 pt-10">
        <span className="flex size-16 items-center justify-center rounded-full bg-[#f1efe9]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3.5 6.5 12 13l8.5-6.5" />
          </svg>
        </span>
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-[22px] font-bold leading-snug">{m.sentTitle}</h1>
          <p className="text-center text-[13px] leading-[1.7] text-[#55524a]">
            {m.sentBody(email || m.sentYourEmail)}
          </p>
        </div>
        <div className="w-full rounded-xl bg-[#faf9f6] px-4 py-3.5 text-xs leading-[1.7] text-[#55524a]">
          {m.sentSpam}
        </div>
        <Link href={withLocale(lang, "/login")} className="mt-auto px-3 py-2.5 text-sm font-medium">{m.sentOther}</Link>
      </div>
    </div>
  );
}
