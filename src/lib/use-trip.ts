"use client";

// 旅の目的（目的シートで選んだもの）を、このブラウザに持つ。トップと提案のシートで同じ値を読む（useSyncExternalStore）。
// 読めない環境（プライベートウィンドウなど）ではこのページの間だけ持つ
import { useSyncExternalStore } from "react";
import { EMPTY_TRIP, parseTrip, tripQuery, type Trip } from "./trip";

const KEY = "wandrara.trip.v1";
let cache: Trip | null = null;
const listeners = new Set<() => void>();

function read(): Trip {
  if (cache) return cache;
  try {
    cache = parseTrip(JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, string>);
  } catch {
    cache = EMPTY_TRIP;
  }
  return cache;
}

export function setTrip(trip: Trip): void {
  cache = trip;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(tripQuery(trip)));
  } catch {
    // 保存できなくても、このページの間は持つ
  }
  listeners.forEach((fn) => fn());
}

/** 水和までは空（サーバーの HTML と揃える） */
export function useTrip(): Trip {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    read,
    () => EMPTY_TRIP,
  );
}

/** 今の目的（提案の URL に足すとき。フックの外で読む） */
export const currentTrip = (): Trip => read();
