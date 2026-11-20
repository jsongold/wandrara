"use client";

// ファイナルの保存先。今はこのブラウザ（localStorage）。DB に移すときは、この 3 つの関数の中身だけ替える
import type { Final } from "./final";

const KEY = "wandrara.finals.v1";

function readAll(): Record<string, Final> {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, Final>) : {};
  } catch {
    return {};
  }
}

/** 保存できたか（できないブラウザでは false。画面はファイルの保存を勧める） */
export function saveFinal(f: Final): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [f.id]: f }));
    return true;
  } catch {
    return false;
  }
}

export const getFinal = (id: string): Final | null => readAll()[id] ?? null;

export const listFinals = (): Final[] => Object.values(readAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** 保存したもの全部の生の文字列（useSyncExternalStore で読む。同じ中身なら同じ値なので再描画しない） */
export function rawFinals(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** 生の文字列から 1 件を取り出す（純関数） */
export function finalFromRaw(raw: string | null, id: string): Final | null {
  try {
    const all: unknown = JSON.parse(raw ?? "{}");
    return (all as Record<string, Final>)?.[id] ?? null;
  } catch {
    return null;
  }
}
