"use client";
// 詳細ページの地図。拡大・縮小・移動できる。駅・お店などは地図の上に出す（一覧にはしない）。
// 何を載せるかは spec（nearbyMap().green().roads()… のメソッドの足し引き）で決める。
// MapLibre（約 270KB gzip）は地図が画面に近づいてから読む。ページを開いた時点では読まない。
// 地図は OpenFreeMap（商用可・キー不要）。出典は MapLibre の既定どおり、最初は開いて出し、地図を動かすと (i) に畳む。
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { messages } from "@/lib/i18n/messages";
import { startLazyMap } from "@/lib/nearby/lazy-map";
import type { NearbySpec } from "@/lib/nearby/spec";
import { filterStyle, STYLE_URL, type Style } from "@/lib/nearby/style";
import type { Locale } from "@/lib/types";

type Props = { spec: NearbySpec; lat: number; lng: number; locale: Locale; label: string; className: string };

async function loadStyle(): Promise<Style> {
  const res = await fetch(STYLE_URL);
  if (!res.ok) throw new Error(`地図の見た目の定義を読めません: ${res.status}`);
  return (await res.json()) as Style;
}

export function NearbyMap({ spec, lat, lng, locale, label, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  // 押すたびに増やして、地図をはじめから開き直す
  const [attempt, setAttempt] = useState(0);
  const t = messages(locale).detail.mapControls;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return startLazyMap({
      observe: (onNear) => {
        const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onNear(), { rootMargin: "300px" });
        io.observe(el);
        return () => io.disconnect();
      },
      load: async () => {
        const [maplibre, style] = await Promise.all([import("maplibre-gl"), loadStyle()]);
        return () => {
          const map = new maplibre.Map({
            container: el,
            style: filterStyle(style, spec.groups, locale) as unknown as import("maplibre-gl").StyleSpecification,
            center: [lng, lat],
            zoom: spec.zoom,
            minZoom: 5,
            maxZoom: 18,
            // ページのスクロールを邪魔しないよう、地図を動かすのは 2 本指（PC は Ctrl / ⌘ + ホイール）
            cooperativeGestures: true,
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false,
            attributionControl: { compact: true },
            locale: {
              "Map.Title": label,
              "Marker.Title": t.marker,
              "AttributionControl.ToggleAttribution": t.toggleAttribution,
              "CooperativeGesturesHandler.MobileHelpText": t.mobileHelp,
              "CooperativeGesturesHandler.WindowsHelpText": t.windowsHelp,
              "CooperativeGesturesHandler.MacHelpText": t.macHelp,
              "NavigationControl.ZoomIn": t.zoomIn,
              "NavigationControl.ZoomOut": t.zoomOut,
            },
          });
          map.touchZoomRotate.disableRotation();
          map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
          new maplibre.Marker({ color: "#141413" }).setLngLat([lng, lat]).addTo(map);
          return map;
        };
      },
      onError: (e) => {
        console.error("地図を開けませんでした", e);
        setFailed(true);
      },
    });
  }, [spec, lat, lng, locale, label, t, attempt]);

  return (
    <div className={`relative h-[240px] overflow-hidden border border-[#d0d5cf] bg-[#eeede7] ${className}`}>
      {failed ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-[#55524a]">
          <p className="m-0">{t.failed}</p>
          <button
            type="button"
            className="rounded-full border border-[#d0d5cf] bg-white px-4 py-2 text-[#141413]"
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            {t.retry}
          </button>
        </div>
      ) : (
        <div key={attempt} ref={ref} role="region" aria-label={label} className="h-full w-full" />
      )}
    </div>
  );
}
