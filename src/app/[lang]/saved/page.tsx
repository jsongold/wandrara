import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/next";
import { getCatalog } from "@/lib/data";
import { isLocale, withLocale } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";
import { getSavedDests } from "@/lib/saves-server";
import { createClient } from "@/lib/supabase/server";
import type { Photo } from "@/lib/types";

export default function SavedPage(props: PageProps<"/[lang]/saved">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#faf9f6]" />}>
      <Saved params={props.params} />
    </Suspense>
  );
}

// 写真が無いときの色面（空と地面）
function placeholderStyle(photo: Photo | null) {
  const sky = photo?.placeholderSky ?? "#8f9692";
  const land = photo?.placeholderLand ?? "#2e322f";
  return { background: `linear-gradient(180deg, ${sky} 0%, ${sky} 56%, ${land} 56%, ${land} 100%)` };
}

async function Saved({ params }: Pick<PageProps<"/[lang]/saved">, "params">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const to = (path: string) => withLocale(lang, path);
  const m = messages(lang).saves;
  const c = messages(lang).common;
  const user = await getCurrentUser();
  if (!user) redirect(to(`/login?next=${encodeURIComponent(to("/saved"))}`));

  const items = await getSavedDests(await createClient(), await getCatalog(), lang);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-[#faf9f6] text-[#171717]">
      <div className="flex h-14 items-center gap-1 px-2">
        <Link href={to("/account")} aria-label={c.back} className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="m-0 text-base font-semibold">{m.title}</h1>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 px-4 pb-7 pt-2">
        {items.length === 0 ? (
          <p data-testid="saved-empty" className="m-0 rounded-2xl bg-white p-4 text-[13px] leading-[1.7] text-[#55524a]">
            {m.empty}
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {items.map((it) => (
              <li key={it.destId}>
                <Link
                  href={it.href}
                  data-testid="saved-item"
                  className="flex items-center gap-3.5 rounded-2xl bg-white p-3 text-[#171717] no-underline"
                >
                  {it.photo?.url && !it.photo.isDemo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.photo.url} alt="" loading="lazy" decoding="async" className="block size-16 flex-none rounded-[10px] object-cover" />
                  ) : (
                    <span className="block size-16 flex-none rounded-[10px]" style={placeholderStyle(it.photo)} />
                  )}
                  <span className="flex min-w-0 flex-col gap-[3px]">
                    <span className="truncate text-[15px] font-semibold">{it.title}</span>
                    <span className="truncate text-[13px] text-[#55524a]">
                      {[it.kindLabel, it.areaLabel].filter(Boolean).join("・")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
