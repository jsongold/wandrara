// 点のまわりの地図。何を載せるかは map（nearbyMap().green().roads()… のメソッドの足し引き）で決める。表示のみ。
// ライブラリもタイル画像も使わず、サーバーで作った SVG だけを送る（src/lib/nearby）。
import { Suspense } from "react";
import { H, W } from "@/lib/nearby/build";
import { getNearby } from "@/lib/nearby/fetch";
import type { NearbyMapSpec } from "@/lib/nearby/spec";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";

type Props = { map: NearbyMapSpec; lat: number; lng: number; locale: Locale; label: string; className: string };

export function NearbyMap(props: Props) {
  return (
    <Suspense fallback={<div className={`aspect-[632/300] bg-[#eceae3] ${props.className}`} />}>
      <NearbyMapBody {...props} />
    </Suspense>
  );
}

/** 距離は 100m 単位（1km 以上は 0.1km 単位）に丸める */
export function formatDistance(m: number, locale: Locale): string {
  const t = messages(locale).detail;
  return m < 1000 ? t.distanceM(Math.max(100, Math.round(m / 100) * 100)) : t.distanceKm((Math.round(m / 100) / 10).toFixed(1));
}

async function NearbyMapBody({ map, lat, lng, locale, label, className }: Props) {
  const nearby = await getNearby(lat, lng, locale, map.spec);
  if (!nearby) return null;
  const t = messages(locale).detail;
  return (
    <div className="flex flex-col gap-2">
      <div className={`relative overflow-hidden border border-[#d0d5cf] bg-[#eeede7] ${className}`}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full">
          {nearby.paths.map((p) => (
            <path
              key={p.key}
              d={p.d}
              fill={p.fill ?? "none"}
              fillRule="evenodd"
              stroke={p.stroke ?? "none"}
              strokeWidth={p.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {nearby.places.flatMap((g) =>
            g.items.filter((s) => s.inView).map((s) => (
              <rect key={`${g.kind}:${s.name}`} x={s.x - 4} y={s.y - 4} width={8} height={8} rx={2} fill="#ffffff" stroke="#55524a" strokeWidth={2} />
            )),
          )}
          <circle cx={nearby.point.x} cy={nearby.point.y} r={9} fill="#141413" stroke="#ffffff" strokeWidth={3} />
        </svg>
        <p className="absolute bottom-0 right-0 m-0 bg-[rgba(255,255,255,0.8)] px-1.5 py-0.5 text-[9px] text-[#55524a]">
          <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>{" "}
          <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">© OpenMapTiles</a>{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>
        </p>
      </div>
      {nearby.places
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <ul key={g.kind} className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]" aria-label={t.places[g.kind].title}>
            {g.items.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="inline-block h-2 w-2 rounded-[2px] border-2 border-[#55524a] bg-white" />
                  {t.places[g.kind].name(s.name)}
                </span>
                <span className="text-[#55524a]">{formatDistance(s.distanceM, locale)}</span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
