"use client";

// エリアを地図から選ぶ。全国 → 地方 → 箱根 と寄り、形か点を押すと onSelect(エリア id)
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AREA_MAP_CREDIT, AREA_MAP_START, type AreaMapData } from "@/lib/area-map";
import { useLocale, useMessages } from "@/lib/i18n/use-locale";
import { AREA_MAP_LOADERS } from "@/generated/area-map";
import { Chip } from "./Chip";
import { usePanZoom } from "./use-pan-zoom";

type Props = { current: string; labelOf: (id: string) => string; onSelect: (id: string) => void };

const FILL = "#5b6455";
const FILL_ON = "#f4f1ea";
const FILL_LINK = "#6f7a66";

function onKey(fn: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
}

export function AreaMap({ current, labelOf, onSelect }: Props) {
  const locale = useLocale();
  const m = useMessages();
  const [trail, setTrail] = useState<string[]>([AREA_MAP_START]);
  const mapId = trail[trail.length - 1];
  const [data, setData] = useState<AreaMapData | null>(null);

  useEffect(() => {
    let alive = true;
    AREA_MAP_LOADERS[mapId]?.().then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [mapId]);

  const shown = data?.id === mapId ? data : null;
  // 地図はドラッグで動かし、ピンチ・ホイールで寄せられる。文字と点は寄せても同じ px に見えるよう k 倍する
  const svgRef = useRef<SVGSVGElement>(null);
  const { viewBox, unit: k } = usePanZoom(svgRef, shown?.viewBox ?? null, shown?.start ?? null);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* 戻る・地図の名前・「〇〇全体」を 1 行に並べ、地図に高さを残す */}
      <div className="flex min-h-10 flex-wrap items-center gap-x-5">
        {trail.length > 1 && (
          <button
            type="button"
            onClick={() => setTrail(trail.slice(0, -1))}
            className="h-10 cursor-pointer border-0 bg-transparent p-0 text-[14px] text-white/65"
          >
            ← {m.common.back}
          </button>
        )}
        <h3 className="m-0 mr-1 text-[15px] font-semibold">{shown ? shown.name[locale] : m.common.loading}</h3>
        {shown?.wholes.map((id) => (
          <Chip key={id} on={current === id} onClick={() => onSelect(id)}>{m.home.areaWhole(labelOf(id))}</Chip>
        ))}
      </div>
      {shown ? (
        <svg
          ref={svgRef}
          viewBox={viewBox}
          role="group"
          aria-label={shown.name[locale]}
          className="block min-h-[160px] w-full flex-1 cursor-grab touch-none select-none overflow-hidden"
        >
          <path d={shown.land} fill="#3b3f39" stroke="rgba(255,255,255,0.18)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
          {shown.shapes.map((s) => (
            <path
              key={s.id}
              d={s.d}
              role="button"
              tabIndex={0}
              aria-label={labelOf(s.id)}
              aria-pressed={current === s.id}
              onClick={() => onSelect(s.id)}
              onKeyDown={onKey(() => onSelect(s.id))}
              fill={current === s.id ? FILL_ON : FILL}
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              className="cursor-pointer outline-none focus-visible:stroke-[#9cc3ff]"
            />
          ))}
          {shown.links.map((l) =>
            l.d ? (
              <path
                key={l.map}
                d={l.d}
                role="button"
                tabIndex={0}
                aria-label={m.home.mapZoom(l.name[locale])}
                onClick={() => setTrail([...trail, l.map])}
                onKeyDown={onKey(() => setTrail([...trail, l.map]))}
                fill={FILL_LINK}
                stroke="#ffffff"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                strokeDasharray="3 2"
                className="cursor-pointer outline-none"
              />
            ) : (
              <circle
                key={l.map}
                cx={l.at[0]}
                cy={l.at[1]}
                r={9 * k}
                role="button"
                tabIndex={0}
                aria-label={m.home.mapZoom(l.name[locale])}
                onClick={() => setTrail([...trail, l.map])}
                onKeyDown={onKey(() => setTrail([...trail, l.map]))}
                fill={FILL_ON}
                stroke="#141413"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer outline-none"
              />
            ),
          )}
          {shown.points.map((p) => (
            <circle
              key={p.id}
              cx={p.at[0]}
              cy={p.at[1]}
              r={7 * k}
              role="button"
              tabIndex={0}
              aria-label={labelOf(p.id)}
              aria-pressed={current === p.id}
              onClick={() => onSelect(p.id)}
              onKeyDown={onKey(() => onSelect(p.id))}
              fill={current === p.id ? FILL_ON : "#1b1b19"}
              stroke="#ffffff"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              className="cursor-pointer outline-none"
            />
          ))}
          <g aria-hidden="true" fontSize={11 * k} textAnchor="middle" fill="#ffffff" stroke="rgba(0,0,0,0.7)" strokeWidth={3 * k} paintOrder="stroke" pointerEvents="none">
            {shown.shapes.map((s) => (
              <text key={s.id} x={s.label[0]} y={s.label[1] + 4 * k}>{labelOf(s.id)}</text>
            ))}
            {shown.links.map((l) => (
              <text key={l.map} x={l.at[0]} y={l.d ? l.at[1] + 4 * k : l.at[1] - 14 * k} fontWeight={700}>{l.name[locale]}</text>
            ))}
            {shown.points.map((p) => (
              <text key={p.id} x={p.at[0]} y={p.at[1] - 11 * k}>{labelOf(p.id)}</text>
            ))}
          </g>
        </svg>
      ) : (
        <div className="min-h-[160px] w-full flex-1" />
      )}
      <p className="m-0 text-[10px] leading-[1.5] text-white/50">{AREA_MAP_CREDIT[locale]}</p>
    </div>
  );
}
