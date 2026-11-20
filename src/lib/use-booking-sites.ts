"use client";

// 予約に使うサイト（提案ページで選んだもの）を、このブラウザに持つ。次の提案でも同じサイトで出す
import { useSyncExternalStore } from "react";
import { DEFAULT_SITES, parseSites, type SiteId } from "./booking-sites";

const KEY = "wandrara.booking-sites.v1";
let cache: SiteId[] | null = null;
const listeners = new Set<() => void>();

function read(): SiteId[] {
  if (cache) return cache;
  try {
    cache = parseSites(window.localStorage.getItem(KEY));
  } catch {
    cache = DEFAULT_SITES;
  }
  return cache;
}

export function setBookingSites(sites: SiteId[]): void {
  cache = sites.length ? sites : DEFAULT_SITES;
  try {
    window.localStorage.setItem(KEY, cache.join(","));
  } catch {
    // 保存できなくても、このページの間は持つ
  }
  listeners.forEach((fn) => fn());
}

/** 水和までは既定（公式）。サーバーの HTML と揃える */
export function useBookingSites(): SiteId[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    read,
    () => DEFAULT_SITES,
  );
}
