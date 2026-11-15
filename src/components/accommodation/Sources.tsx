import type { AccommodationView } from "@/lib/accommodation/view";
import { ExpandRow, SubRow } from "../ExpandRow";
import { TopicCard } from "./Topics";

// 出典。行は名前とどの項目の出典か、開くと URL・種類・取得日

/** 見せる URL は https:// と末尾の / を落とす */
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function Sources({ sources }: { sources: AccommodationView["sources"] }) {
  if (!sources.length) return null;
  return (
    <TopicCard title="出典">
      {sources.map((s, i) => (
        <ExpandRow key={`${s.url}-${i}`} label={s.name} value={s.fields.length ? s.fields.join("・") : s.typeLabel}>
          <SubRow
            label="URL"
            value={
              <a href={s.url} target="_blank" rel="noopener" className="break-all text-[#141413] underline">
                {shortUrl(s.url)}
              </a>
            }
          />
          <SubRow label="種類" value={s.typeLabel} />
          <SubRow label="取得日" value={s.retrievedAt} />
        </ExpandRow>
      ))}
    </TopicCard>
  );
}
