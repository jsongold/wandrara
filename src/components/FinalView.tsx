"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { bookingHandoff } from "@/lib/booking/handoff";
import { downloadText } from "@/lib/download-text";
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
// ファイナル：確定した完成版。旅程の形を選び（今はテキスト）、ファイルに保存・共有する。
// 予約は Agent に任せる：指示（予約するもの・リンク・守ること・報告の形）をコピーして渡す。自動の予約（/api/booking）は方式が決まるまで使わない
export function FinalView({ locale, id }: { locale: Locale; id: string }) {
  const m = messages(locale);
  const f = m.final;
  const raw = useSyncExternalStore(noop, rawFinals, () => null);
  const final = useMemo(() => finalFromRaw(raw, id), [raw, id]);
  const sites = useBookingSites();
  const [format, setFormat] = useState<Format>("text");
  const [copied, setCopied] = useState(false);

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

  const handoff = bookingHandoff(final, f.handoff, sites);
  async function copyHandoff() {
    try {
      await navigator.clipboard.writeText(handoff);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  const download = () => downloadText(final.text, finalFileName(final));
  const date = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", { dateStyle: "long" }).format(new Date(final.createdAt));

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

      {/* 予約を Agent に任せる：指示をコピーして、ブラウザを操作できる Agent に貼る */}
      <section aria-label={f.agentBook} className="flex flex-col gap-2.5 rounded-[18px] bg-[#1b1b19] p-4">
        <h2 className="m-0 text-[15px] font-bold">{f.agentBook}</h2>
        <ol className="m-0 flex list-none flex-col gap-1 p-0 text-[12.5px] leading-relaxed text-white/75">
          {f.agentBookSteps.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
        <button type="button" onClick={copyHandoff} className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[14px] border-0 bg-[#f4f1ea] text-[15px] font-bold text-[#141413]">
          <Icon name={copied ? "check" : "copy"} size={16} />
          {copied ? m.plan.copied : f.agentBookCopy}
        </button>
        <details className="text-[12.5px] text-white/70">
          <summary className="cursor-pointer py-2">{f.agentBookShow}</summary>
          <pre className="m-0 max-h-[320px] overflow-y-auto whitespace-pre-wrap break-all rounded-[12px] bg-black/30 p-3 font-sans text-[12px] leading-relaxed text-white/85">{handoff}</pre>
        </details>
      </section>
    </main>
  );
}
