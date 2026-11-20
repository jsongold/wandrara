// 予約の部品の型。予約の仕方（手続きのリンクを返す・API・ブラウザ操作など）は BookingExecutor として差し替える
import type { SiteId } from "../booking-sites";

/** 予約したい 1 件：場所・使うリンク・旅の条件（人数・時期など。表示用の短い名前） */
export type BookingRequest = { placeTitle: string; label: string; url: string; site: SiteId | null; trip: string };

/**
 * booked：自動で予約できた（confirmation に予約番号など）
 * needs_user：自動ではできない。url で本人が手続きする（reason に理由）
 * failed：試したが失敗した
 */
export type BookingStatus = "booked" | "needs_user" | "failed";
export type BookingReason = "booked" | "not_supported" | "needs_login" | "sold_out" | "error";
export type BookingResult = { placeTitle: string; label: string; url: string; site: SiteId | null; status: BookingStatus; reason: BookingReason; confirmation?: string; executor: string };

export type BookingExecutor = { readonly name: string; canHandle(req: BookingRequest): boolean; book(req: BookingRequest): Promise<BookingResult> };
