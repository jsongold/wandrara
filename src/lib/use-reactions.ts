"use client";

// カードへのリアクションを localStorage に持ち、どのカードからも同じ値を読む（useSyncExternalStore）。
// 読めない環境（プライベートウィンドウなど）ではこのページの間だけ持つ
import { useSyncExternalStore } from "react";
import { parseReactions, react, type Reaction, type Reactions } from "./reactions";

const KEY = "wandrara.reactions.v1";
const EMPTY: Reactions = {};
let cache: Reactions | null = null;
const listeners = new Set<() => void>();

function read(): Reactions {
  if (cache) return cache;
  try {
    cache = parseReactions(window.localStorage.getItem(KEY));
  } catch {
    cache = {};
  }
  return cache;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setReaction(destId: string, r: Reaction): void {
  cache = react(read(), destId, r);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // 保存できなくても、このページの間は持つ
  }
  listeners.forEach((fn) => fn());
}

/** 水和までは空（サーバーの HTML と揃える） */
export function useReactions(): Reactions {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
