import type { AccommodationView } from "@/lib/accommodation/view";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";
import { ExpandRow, SubRow } from "../ExpandRow";
import { Card } from "./Card";

// 出典。行は名前とどの項目の出典か、開くと URL・種類・取得日

/** 見せる URL は https:// と末尾の / を落とす */
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function Sources({ sources, locale }: { sources: AccommodationView["sources"]; locale: Locale }) {
  if (!sources.length) return null;
  const t = messages(locale).accommodation;
  return (
    <Card title={t.title.sources}>
      {sources.map((s, i) => (
        <ExpandRow key={`${s.url}-${i}`} label={s.name} value={s.fields.length ? s.fields.join(t.sep) : s.typeLabel}>
          <SubRow
            label={t.source.url}
            value={
              <a href={s.url} target="_blank" rel="noopener" className="break-all text-[#141413] underline">
                {shortUrl(s.url)}
              </a>
            }
          />
          <SubRow label={t.source.type} value={s.typeLabel} />
          <SubRow label={t.source.retrievedAt} value={s.retrievedAt} />
        </ExpandRow>
      ))}
    </Card>
  );
}
