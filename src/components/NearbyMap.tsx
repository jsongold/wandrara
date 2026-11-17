"use client";
// 詳細ページの地図。拡大・縮小・移動できる。駅・お店などは地図の上に出す（一覧にはしない）。
// 何を載せるかは spec（nearbyMap().green().roads()… のメソッドの足し引き）で決める。
// MapLibre（約 270KB gzip）は地図が画面に近づいてから読む。ページを開いた時点では読まない。
// 地図は OpenFreeMap（商用可・キー不要）。出典は右下の (i) に出る。
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { messages } from "@/lib/i18n/messages";
import type { NearbySpec } from "@/lib/nearby/spec";
import { filterStyle, STYLE_URL, type Style } from "@/lib/nearby/style";
import type { Locale } from "@/lib/types";

type Props = { spec: NearbySpec; lat: number; lng: number; locale: Locale; label: string; className: string };

export function NearbyMap({ spec, lat, lng, locale, label, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;
    const t = messages(locale).detail.mapControls;
    const open = async () => {
      const [maplibre, style] = await Promise.all([
        import("maplibre-gl"),
        fetch(STYLE_URL).then((r) => r.json() as Promise<Style>),
      ]);
      if (cancelled) return;
      map = new maplibre.Map({
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
      // 出典は最初は (i) だけにしておく（押すと開く）。狭い枠だと開いたままで地図を隠すため
      map.once("load", () => el.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show"));
    };
    // 画面に近づいたら一度だけ開く
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        open().catch((e) => console.error("地図を開けませんでした", e));
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      map?.remove();
    };
  }, [spec, lat, lng, locale]);
  return <div ref={ref} role="region" aria-label={label} className={`relative h-[240px] overflow-hidden border border-[#d0d5cf] bg-[#eeede7] ${className}`} />;
}
