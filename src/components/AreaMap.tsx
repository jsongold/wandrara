"use client";

// エリアを 1 枚の地図から選ぶ。引いているときは親エリア、寄せると子エリア（市区町村・町丁字・点）。
// 下の特性のバーで絞ると、合わないエリアは OFF（暗く・押せない・ラベルなし）になる。押すと onSelect(エリア id)
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { AREA_MAP_CREDIT, CHILD_ZOOM, type MapArea } from "@/lib/area-map";
import { filterAreas, type AreaTraits } from "@/lib/area-filter";
import { layoutLabels, type LabelCandidate } from "@/lib/area-labels";
import { useLocale, useMessages } from "@/lib/i18n/use-locale";
import { fitView, parseView, toScreen } from "@/lib/pan-zoom";
import { useAreaMapBase, useAreaMapChildren } from "./use-area-map-data";
import { usePanZoom } from "./use-pan-zoom";

type Props = {
  current: string;
  labelOf: (id: string) => string;
  parentOf: Record<string, string | null>;
  onSelect: (id: string) => void;
  traits?: AreaTraits;
};

const FILL = "#4a5147";
const FILL_ON = "#f4f1ea";
const FILL_OFF = "#1a1b19";
const GLASS: CSSProperties = {
  background: "rgba(18,18,16,0.62)",
  backdropFilter: "blur(16px) saturate(1.2)",
  WebkitBackdropFilter: "blur(16px) saturate(1.2)",
  border: "1px solid rgba(255,255,255,0.14)",
};
const TOP_PX = 56; // 上の文字の下からラベルを出す
const BOTTOM_PX = 64; // 下の特性のバーの上まで

function onKey(fn: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
}

/** 政令市の区は「横浜市中区」→「中区」と短くする（地図では親が横浜と分かる） */
const shortName = (s: string) => s.replace(/^[^・]+市(.+区)$/, "$1");

export function AreaMap({ current, labelOf, parentOf, onSelect, traits }: Props) {
  const locale = useLocale();
  const m = useMessages();
  const base = useAreaMapBase();
  const svgRef = useRef<SVGSVGElement>(null);
  const { viewBox, unit: k, view, box, setView } = usePanZoom(svgRef, base?.viewBox ?? null, base?.start ?? null);
  const start = useMemo(() => (base ? parseView(base.start) : null), [base]);
  const { zoomed, children } = useAreaMapChildren(base, view, start, box);

  const [picked, setPicked] = useState<string[]>([]);
  const on = useMemo(() => (traits ? filterAreas(traits.byRegion, picked, parentOf) : null), [traits, picked, parentOf]);
  const isOff = (id: string) => !!on && !on.has(id);

  const flyTo = (a: MapArea) => {
    // 枠の大きさがまだ測れていない（開いた直後に押した）ときは、その場で測る
    const r = svgRef.current?.getBoundingClientRect();
    const frame = box ?? (r ? { w: r.width, h: r.height } : null);
    if (!frame || frame.w <= 0 || !start) return;
    setView(fitView(a.box, frame, start.w / (CHILD_ZOOM * 1.1)));
  };
  const zoomBy = (f: number) => {
    if (!view) return;
    const cx = view.x + view.w / 2, cy = view.y + view.h / 2;
    setView({ x: cx - view.w / f / 2, y: cy - view.h / f / 2, w: view.w / f, h: view.h / f });
  };

  // 寄せているとき、子を読み終わった親は子に任せる（親の形は塗りだけ）
  const covered = new Set(zoomed ? children.map((c) => c.parent) : []);
  // 親自身の材料の残り（id = 親）は子と同じに描くが、親を選んだときの明るさは親の形に任せる
  const kidShapes = children.flatMap((c) => c.shapes.map((s) => ({ ...s, rest: s.id === c.parent })));
  const kidPoints = children.flatMap((c) => c.points);
  const currentParent = parentOf[current] ?? null;

  const labels = (() => {
    if (!base || !view || !box) return [];
    const cand = (id: string, at: [number, number], size: [number, number], font: number): LabelCandidate => ({
      id, text: shortName(labelOf(id)), at: toScreen(view, box, at[0], at[1]), size, font, rank: size[0] * size[1],
    });
    const fromArea = (a: MapArea, font: number) => cand(a.id, a.label, [a.box[2] / k, a.box[3] / k], font);
    const list: LabelCandidate[] = [
      ...base.parents.filter((p) => !zoomed || !covered.has(p.id)).map((p) => fromArea(p, 13)),
      ...(zoomed ? kidShapes.filter((s) => !s.rest).map((s) => fromArea(s, 11)) : []),
      ...(zoomed ? kidPoints.map((p) => cand(p.id, p.at, [40, 40], 11)) : []),
    ].filter((c) => !isOff(c.id) || c.id === current);
    return layoutLabels(list, { width: box.w - 48, height: box.h, top: TOP_PX, bottom: BOTTOM_PX, selected: current === "all" ? null : current });
  })();

  const areaProps = (id: string, after?: () => void) => {
    const off = isOff(id);
    return {
      role: "button",
      tabIndex: off ? -1 : 0,
      "aria-label": labelOf(id),
      "aria-pressed": current === id,
      "aria-disabled": off || undefined,
      onClick: off ? undefined : () => { onSelect(id); after?.(); },
      onKeyDown: off ? undefined : onKey(() => { onSelect(id); after?.(); }),
      className: off ? "cursor-default outline-none" : "cursor-pointer outline-none focus-visible:stroke-[#9cc3ff]",
    } as const;
  };
  const fill = on ? "#5b6656" : FILL; // 絞り込み中は合うエリアを明るく
  const parentFill = (id: string) => (current === id ? FILL_ON : currentParent === id ? "#6f7a66" : isOff(id) ? FILL_OFF : fill);

  const matchCount = on ? base?.parents.filter((p) => on.has(p.id)).length ?? 0 : 0;
  const pickedNames = traits?.traits.filter((t) => picked.includes(t.id)).map((t) => t.label).join("・") ?? "";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="relative min-h-[240px] flex-1 overflow-hidden rounded-xl">
        {base ? (
          <svg
            ref={svgRef}
            viewBox={viewBox}
            role="group"
            aria-label={m.home.mapLabel}
            className="absolute inset-0 block h-full w-full cursor-grab touch-none select-none"
          >
            <path d={base.land} fill="#2a2d29" />
            {base.parents.map((p) =>
              zoomed && covered.has(p.id) ? (
                <path key={p.id} d={p.d} aria-hidden="true" fill={current === p.id || currentParent === p.id ? "#6f7a66" : isOff(p.id) ? FILL_OFF : fill} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
              ) : (
                <path
                  key={p.id}
                  d={p.d}
                  {...areaProps(p.id, () => flyTo(p))}
                  fill={parentFill(p.id)}
                  stroke={isOff(p.id) ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.45)"}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ),
            )}
            {zoomed && kidShapes.map((s) => (
              <path
                key={`c:${s.id}`}
                d={s.d}
                {...areaProps(s.id)}
                fill={current === s.id && !s.rest ? FILL_ON : isOff(s.id) ? FILL_OFF : "transparent"}
                fillOpacity={isOff(s.id) ? 0.75 : 0.9}
                stroke={current === s.id && !s.rest ? "#ffffff" : "rgba(255,255,255,0.22)"}
                strokeWidth={current === s.id && !s.rest ? 2 : 0.8}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {zoomed && kidPoints.map((p) => (
              <circle
                key={`p:${p.id}`}
                cx={p.at[0]}
                cy={p.at[1]}
                r={7 * k}
                {...areaProps(p.id)}
                fill={current === p.id ? FILL_ON : isOff(p.id) ? FILL_OFF : "#1b1b19"}
                stroke="#ffffff"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        ) : (
          <div className="absolute inset-0" />
        )}

        {/* ラベル：画面の px で置く（寄せても同じ大きさ）。重なるもの・小さすぎるもの・OFF は出さない */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {labels.map((l) => (
            <span
              key={l.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-semibold"
              style={{
                left: l.x,
                top: l.y,
                fontSize: parentOf[l.id] === null || parentOf[l.id] === undefined ? 13 : 11,
                color: l.id === current ? "#ffffff" : "rgba(244,241,234,0.9)",
                fontWeight: l.id === current ? 800 : 600,
                textShadow: "0 1px 2px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7)",
              }}
            >
              {shortName(labelOf(l.id))}
            </span>
          ))}
        </div>

        {/* 上：選んだエリア（文字だけ）。未選択なら合うエリアの数 */}
        <div className="pointer-events-none absolute inset-x-3 top-2 flex items-center gap-3" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)" }}>
          <div className="min-w-0 flex-1" aria-live="polite">
            {current !== "all" ? (
              <>
                <b className="block truncate text-[18px] font-extrabold">{labelOf(current)}</b>
                <span className="text-[12px] text-white/60">{currentParent ? labelOf(currentParent) : ""}</span>
              </>
            ) : on ? (
              <>
                <b className="block text-[18px] font-extrabold">{m.home.mapMatch(matchCount)}</b>
                <span className="text-[12px] text-white/60">{pickedNames}</span>
              </>
            ) : (
              <>
                <b className="block text-[18px] font-extrabold">{m.home.allAreasChip}</b>
                <span className="text-[12px] text-white/60">{m.home.mapHint}</span>
              </>
            )}
          </div>
          {current !== "all" && (
            <button type="button" onClick={() => onSelect("all")} className="pointer-events-auto h-9 cursor-pointer rounded-[10px] border-0 bg-white/10 px-3 text-[13px] text-white" style={{ textShadow: "none" }}>
              {m.home.mapClear}
            </button>
          )}
        </div>

        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-xl" style={GLASS}>
          <button type="button" aria-label={m.home.mapZoomIn} onClick={() => zoomBy(2)} className="h-10 w-10 cursor-pointer border-0 bg-transparent text-[18px] text-white">＋</button>
          <button type="button" aria-label={m.home.mapZoomOut} onClick={() => zoomBy(0.5)} className="h-10 w-10 cursor-pointer border-0 border-t border-solid border-white/15 bg-transparent text-[18px] text-white">−</button>
        </div>

        {/* 下：特性のバー（横にスクロール）。選ぶと太字・下線 */}
        {traits && traits.traits.length > 0 && (
          <div role="group" aria-label={m.home.mapTraits} className="absolute inset-x-2 bottom-2 flex gap-1 overflow-x-auto rounded-2xl px-1.5 py-1 [scrollbar-width:none]" style={GLASS}>
            {traits.traits.map((t) => {
              const pressed = picked.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setPicked(pressed ? picked.filter((x) => x !== t.id) : [...picked, t.id])}
                  className="h-10 shrink-0 cursor-pointer border-0 bg-transparent px-2.5 text-[14px] whitespace-nowrap"
                  style={pressed
                    ? { color: "#ffffff", fontWeight: 800, textDecoration: "underline", textUnderlineOffset: 6, textDecorationThickness: 2 }
                    : { color: "rgba(244,241,234,0.6)" }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <p className="m-0 text-[10px] leading-[1.5] text-white/50">{AREA_MAP_CREDIT[locale]}</p>
    </div>
  );
}

