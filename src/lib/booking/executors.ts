// 使う予約の仕方の並び（先に扱えるものが使われる）。自動予約（API・ブラウザ操作など）は、方式をユーザーと決めてからここに足す。
// 今は手続きのリンクを返すだけ（実際の予約・決済はしない）
import { manualExecutor } from "./run";
import type { BookingExecutor } from "./types";

export const EXECUTORS: BookingExecutor[] = [manualExecutor];
