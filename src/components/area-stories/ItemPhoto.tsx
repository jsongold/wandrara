// 候補の写真と写真の権利。写真が無ければ色面（MS1 で next/image と小さい画像にする）
import type { CSSProperties } from "react";
import { licenseUrl, type HighlightItem, type HighlightPhoto } from "@/lib/area-highlights";
import type { HighlightMessages } from "./types";

export const colorFill = (color: string): CSSProperties => ({ background: `linear-gradient(160deg, ${color} 0%, #1b1b19 130%)` });

export function ItemPhoto({ item, className }: { item: HighlightItem; className: string }) {
  if (!item.photo) return <span aria-hidden="true" className={`block ${className}`} style={colorFill(item.color)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={item.photo.url} alt="" className={`block object-cover ${className}`} />;
}

// 作者は元のページへ、ライセンスはライセンスのページへつなぐ（CC BY・CC BY-SA の表示の決まり）
export function PhotoCredit({ photo, m }: { photo: HighlightPhoto; m: HighlightMessages }) {
  const lic = licenseUrl(photo.license);
  const link = "text-white/60 underline decoration-white/30 underline-offset-2";
  return (
    <span className="text-[10px] text-white/60">
      {m.photoLabel}
      <a href={photo.source} target="_blank" rel="noopener" className={link}>{photo.credit}</a>
      {" · "}
      {lic ? <a href={lic} target="_blank" rel="noopener license" className={link}>{photo.license}</a> : photo.license}
    </span>
  );
}
