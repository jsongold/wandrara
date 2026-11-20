"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { BookingResult } from "@/lib/booking/types";
import { requestsOf, summarize } from "@/lib/booking/run";
import { finalFileName } from "@/lib/final";
import { finalFromRaw, rawFinals } from "@/lib/final-store";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";
import { useBookingSites } from "@/lib/use-booking-sites";
import { Icon } from "./icons";

type Format = "text" | "image" | "slides" | "video";
const FORMATS: Format[] = ["text", "image", "slides", "video"];
const READY: Format[] = ["text"]; // 画像・プレゼン・動画は準備中

const noop = () => () => {};
type Booking = { status: "idle" } | { status: "running" } | { status: "error" } | { status: "done"; results: BookingResult[] };

// ファイナル：確定した完成版。旅程の形を選び（今はテキスト）、ファイルに保存・共有し、予約するとできた・できなかったを返す
export function FinalView({ locale, id }: { locale: Locale; id: string }) {
  const m = messages(locale);
  const f = m.final;
  const raw = useSyncExternalStore(noop, rawFinals, () => null);
  const final = useMemo(() => finalFromRaw(raw, id), [raw, id]);
  const sites = useBookingSites();
  const [format, setFormat] = useState<Format>("text");
  const [booking, setBooking] = useState<Booking>({ status: "idle" });

  if (!final) {
    return (
      <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col items-center justify-center gap-4 bg-[#0f0f0e] px-8 text-center text-white">
        <p className="m-0 text-[15px]">{f.notFound}</p>
        <Link href={`/${locale}`} className="text-[14px] text-[#f4f1ea]">
          {m.common.back}
        </Link>
      </main>
    );
  }

  const requests = requestsOf(final, sites);
  async function book() {
    setBooking({ status: "running" });
    try {
      const r = await fetch("/api/booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requests }) });
      if (!r.ok) throw new Error(String(r.status));
      setBooking({ status: "done", results: ((await r.json()) as { results: BookingResult[] }).results });
    } catch {
      setBooking({ status: "error" });
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([final!.text], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: finalFileName(final!) });
    a.click();
    URL.revokeObjectURL(url);
  }
  const date = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", { dateStyle: "long" }).format(new Date(final.createdAt));
  const sum = booking.status === "done" ? summarize(booking.results) : null;

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-5 bg-[#0f0f0e] px-4 pb-12 pt-3 text-white">
      <header className="flex items-center gap-1">
        <Link href={`/${locale}`} aria-label={m.common.back} className="flex h-11 w-11 flex-none items-center justify-center text-white">
          <Icon name="back" size={20} />
        </Link>
        <div className="min-w-0">
          <h1 className="m-0 truncate font-[family-name:var(--font-phrase)] text-[19px] font-bold leading-snug">{final.heading || f.title}</h1>
          <p className="m-0 flex items-center gap-1 text-[12px] text-white/60">
            <Icon name="flag" size={12} />
            {f.title}　{f.savedOn(date)}
          </p>
        </div>
      </header>

      {/* 旅程の形：テキスト・画像・プレゼン・動画（今はテキストだけ） */}
      <section aria-label={f.format} className="flex flex-col gap-2">
        <h2 className="m-0 text-[12px] font-normal text-white/60">{f.format}</h2>
        <div role="group" aria-label={f.format} className="flex flex-wrap gap-1.5">
          {FORMATS.map((x) => {
            const ready = READY.includes(x);
            const on = format === x;
            return (
              <button key={x} type="button" disabled={!ready} aria-pressed={on} onClick={() => setFormat(x)} className={`min-h-10 cursor-pointer rounded-full border px-3.5 text-[13px] disabled:cursor-default ${on ? "border-[#f4f1ea] bg-[#f4f1ea] font-bold text-[#141413]" : ready ? "border-white/30 bg-transparent text-white" : "border-white/10 bg-transparent text-white/35"}`}>
                {f.formats[x]}
                {!ready && <span className="ml-1 text-[11px]">{f.soon}</span>}
              </button>
            );
          })}
        </div>
      </section>

      {format === "text" && (
        <section aria-label={f.formats.text} className="flex flex-col gap-2">
          <pre className="m-0 whitespace-pre-wrap break-all rounded-[16px] bg-[#1b1b19] p-4 font-sans text-[13px] leading-relaxed text-white/90">{final.text}</pre>
          <div className="flex gap-2">
            <button type="button" onClick={download} className="flex h-11 flex-auto cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-white/30 bg-transparent text-[14px] font-bold text-white">
              <Icon name="copy" size={16} />
              {f.download}
            </button>
            <button type="button" onClick={() => (typeof navigator.share === "function" ? navigator.share({ text: final.text }).catch(() => {}) : navigator.clipboard.writeText(final.text).catch(() => {}))} className="flex h-11 flex-auto cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-white/30 bg-transparent text-[14px] font-bold text-white">
              <Icon name="share" size={16} />
              {f.share}
            </button>
          </div>
        </section>
      )}

      {/* 予約：ファイナルの予約リンクから、場所ごとに 1 件。自動でできないものは手続きのリンクを返す */}
      <section aria-label={f.book} className="flex flex-col gap-2.5 rounded-[18px] bg-[#1b1b19] p-4">
        {requests.length === 0 ? (
          <p className="m-0 text-[13px] text-white/60">{f.noBookings}</p>
        ) : (
          <>
            <button type="button" onClick={book} disabled={booking.status === "running"} className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[14px] border-0 bg-[#f4f1ea] text-[15px] font-bold text-[#141413] disabled:opacity-60">
              <Icon name="check" size={16} />
              {booking.status === "running" ? f.booking : f.book}
            </button>
            <p className="m-0 text-[12px] text-white/55">{f.bookHint}</p>
          </>
        )}
        {booking.status === "error" && (
          <p role="alert" className="m-0 text-[12.5px] text-[#f4c9a8]">
            {f.failed}
          </p>
        )}
        {booking.status === "done" && sum && (
          <div aria-live="polite" className="flex flex-col gap-2">
            <h2 className="m-0 mt-1 text-[14px] font-bold">
              {f.results}　<span className="text-[12px] font-normal text-white/70">{f.summary(sum.booked, sum.notBooked)}</span>
            </h2>
            <ul className="m-0 flex list-none flex-col p-0">
              {booking.results.map((r) => (
                <li key={r.url} className="flex flex-col gap-1 border-t border-white/[0.08] py-2.5">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-bold">{r.placeTitle}</span>
                    <span className={`flex-none text-[12px] font-bold ${r.status === "booked" ? "text-[#bfe3c8]" : "text-[#f4c9a8]"}`}>{f.status[r.status]}</span>
                  </span>
                  <span className="text-[12px] text-white/65">
                    {r.label ? `${r.label}　` : ""}
                    {f.reason[r.reason]}
                    {r.confirmation ? `　${f.confirmation(r.confirmation)}` : ""}
                  </span>
                  {r.status !== "booked" && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-1.5 self-start text-[13px] font-bold text-[#f4f1ea]">
                      <Icon name="external" size={14} />
                      {f.openLink}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
