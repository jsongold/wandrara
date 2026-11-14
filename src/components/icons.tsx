// 線で描く SVG アイコン。currentColor で色を受け取る
const PATHS: Record<string, string> = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  bed: "M3 18V7M3 14h18M21 18v-6a2 2 0 0 0-2-2h-8v4M6 11h2",
  steam: "M4 17c0 2 3.6 3 8 3s8-1 8-3-3.6-3-8-3-8 1-8 3zM8 11c-1-1.5 1-2.5 0-4M12 11c-1-1.5 1-2.5 0-4M16 11c-1-1.5 1-2.5 0-4",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  tree: "M12 3l6 9h-4l4 6H6l4-6H6zM12 18v3",
  wave: "M3 10c2 0 2-2 4.5-2S10 10 12 10s2-2 4.5-2S19 10 21 10M3 16c2 0 2-2 4.5-2S10 16 12 16s2-2 4.5-2S19 16 21 16",
  hike: "M3 20l7-12 4 6 2-3 5 9zM10 8V3l4 1.5L10 6",
  fork: "M7 3v8a2 2 0 0 0 2 2v8M11 3v8M7 7h4M17 3c-2 0-3 2-3 6s1 4 3 4v8",
  wine: "M8 3h8l-.5 5a3.5 3.5 0 0 1-7 0zM12 12v8M8 21h8",
  umbrella: "M3 12a9 9 0 0 1 18 0zM12 12v7a2 2 0 0 0 4 0",
  flame: "M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 1 2 2 3 1-1-2 0-4 0-5z",
  tent: "M3 20L12 4l9 16zM9 20l3-6 3 6",
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
  filter: "M4 7h10M18 7h2M16 5v4M4 17h4M12 17h8M10 15v4",
  heart: "M12 20s-7-4.5-9-9a4.5 4.5 0 0 1 8-3.5L12 9l1-1.5A4.5 4.5 0 0 1 21 11c-2 4.5-9 9-9 9z",
  menu: "M4 7h16M4 12h16M4 17h16",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  map: "M9 4l6 2 5-2v14l-5 2-6-2-5 2V6zM9 4v14M15 6v14",
  close: "M6 6l12 12M18 6L6 18",
  back: "M15 5l-7 7 7 7",
  share: "M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6",
  "chevron-down": "M6 9l6 6 6-6",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  plus: "M12 5v14M5 12h14",
};

export function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const d = PATHS[name] ?? PATHS.grid;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}
