"use client";
// 詳細ページの地図。地理院タイル（淡色地図）に dest の場所を点で 1 つ出す。表示のみ（点を押しても何もしない）。
// 地理院タイルは出典の明示だけで申請不要・PDL1.0 で商用可（https://maps.gsi.go.jp/development/ichiran.html）。
// Leaflet は window を使うので、画面に出てから読む。
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

const TILE_URL = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png";
const ATTRIBUTION = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>';
const ZOOM = 14;

export function DestMap({ lat, lng, ariaLabel, className }: { lat: number; lng: number; ariaLabel: string; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !ref.current) return;
      // 表示のみ。ページのスクロールを邪魔しないよう、地図は動かさない
      map = L.map(ref.current, {
        center: [lat, lng],
        zoom: ZOOM,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomControl: false,
        attributionControl: false,
      });
      L.control.attribution({ prefix: false }).addTo(map);
      L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, minZoom: 5, maxZoom: 18 }).addTo(map);
      L.circleMarker([lat, lng], { radius: 8, color: "#ffffff", weight: 2, fillColor: "#141413", fillOpacity: 1, interactive: false }).addTo(map);
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng]);
  return <div ref={ref} role="img" aria-label={ariaLabel} className={`isolate overflow-hidden border border-[#d0d5cf] bg-[#dfe3de] ${className}`} />;
}
