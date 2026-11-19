"use client";

// seen-store：どの項目を見たかを端末ごと（localStorage）に覚える。ログインした利用者ごとに覚えるかは未決定（#116）
import { useSyncExternalStore } from "react";
import type { HighlightKind } from "@/lib/area-highlights";

const SEEN_EVENT = "wandrara:highlights-seen";
const seenKey = (area: string) => `wandrara:highlights-seen:${area}`;

function readSeen(area: string): string {
  try {
    return localStorage.getItem(seenKey(area)) ?? "[]";
  } catch {
    return "[]";
  }
}

function parseSeen(raw: string): HighlightKind[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function markSeen(area: string, kind: HighlightKind) {
  const cur = parseSeen(readSeen(area));
  if (cur.includes(kind)) return;
  try {
    localStorage.setItem(seenKey(area), JSON.stringify([...cur, kind]));
  } catch {
    // 保存できない端末（プライベートモードなど）では、毎回まだ見ていない扱いにする
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

function subscribeSeen(cb: () => void) {
  window.addEventListener(SEEN_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(SEEN_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

// そのエリアで見た項目。サーバーでは空（見ていない扱い）
export function useSeen(area: string): HighlightKind[] {
  return parseSeen(useSyncExternalStore(subscribeSeen, () => readSeen(area), () => "[]"));
}
