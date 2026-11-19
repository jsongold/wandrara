// offer-row：扱う店の 1 行。左に店のサムネイル（カルーセル）、右に店名・住所・営業時間・参考価格、右下にアイコンの行動ボタン（地図・サイト・購入）
import type { HighlightOffer } from "@/lib/area-highlights";
import { Icon } from "../icons";
import { colorFill } from "./ItemPhoto";
import { mapsUrl } from "./maps-url";
import type { HighlightMessages } from "./types";

// 行動ボタンはアイコンだけの角丸の四角（アプリ全体のボタンと同じ形）
const ICON_BTN = "flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white/[0.08] text-white";

export function OfferRow({ o, m }: { o: HighlightOffer; m: HighlightMessages }) {
  const where = o.online ? m.online : o.address;
  const when = [o.hours, o.closed && m.closedOn(o.closed)].filter(Boolean).join(" · ");
  return (
    <li className="flex gap-3">
      <ShopThumbs o={o} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[14px] font-semibold">{o.shopName}</span>
          {(where || when) && <span className="text-[11px] leading-snug text-white/65">{[where, when].filter(Boolean).join(" · ")}</span>}
          {(o.price != null || o.priceNote) && (
            <span className="text-[11px] leading-snug text-white/85">
              {o.price != null && m.price(o.price)}
              {o.priceNote && <span className="text-white/60">{`${o.price != null ? " · " : ""}${o.priceNote}`}</span>}
            </span>
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          {!o.online && (
            <a href={mapsUrl(o)} target="_blank" rel="noopener" aria-label={m.openMapOf(o.shopName)} title={m.openMapOf(o.shopName)} className={ICON_BTN}>
              <Icon name="pin" size={18} />
            </a>
          )}
          {o.url && (
            <a href={o.url} target="_blank" rel="noopener" aria-label={m.openSiteOf(o.shopName)} title={m.openSiteOf(o.shopName)} className={ICON_BTN}>
              <Icon name="external" size={18} />
            </a>
          )}
          <button type="button" disabled aria-label={`${m.buyHere}（${m.buyHereSoon}）`} title={`${m.buyHere}（${m.buyHereSoon}）`} className={`${ICON_BTN} cursor-not-allowed opacity-50`}>
            <Icon name="wallet" size={18} />
          </button>
        </div>
      </div>
    </li>
  );
}

// 店のサムネイル。横にめくれるカルーセル（店の写真が無いときは仮の 1 枚＝店名の頭文字）
function ShopThumbs({ o }: { o: HighlightOffer }) {
  const frames = o.photos.length > 0 ? o.photos : [null];
  return (
    <div className="flex h-[76px] w-[76px] flex-none snap-x snap-mandatory overflow-x-auto rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-hidden="true">
      {frames.map((ph, i) =>
        ph ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={ph.url} src={ph.url} alt="" className="h-full w-full flex-none snap-start object-cover" />
        ) : (
          <span key={i} className="flex h-full w-full flex-none snap-start items-center justify-center text-lg font-semibold text-white/80" style={colorFill(colorOfName(o.shopName))}>
            {o.shopName.slice(0, 1)}
          </span>
        ),
      )}
    </div>
  );
}

const THUMB_COLORS = ["#5a4a3c", "#3f5560", "#4f4a62", "#4a5a45", "#62453f"];
function colorOfName(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return THUMB_COLORS[h % THUMB_COLORS.length];
}
