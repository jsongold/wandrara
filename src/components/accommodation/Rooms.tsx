import Image from "next/image";
import type { RoomView } from "@/lib/accommodation/view";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";
import { ExpandRow, SubRow } from "../ExpandRow";
import { Card } from "./Card";
import { roomSummary } from "./format";

// 行の値に出ていないこと（眺望・喫煙・写真・寝室の名前とベッド）があるときだけ開ける
function hasMore(r: RoomView, photos: number): boolean {
  return r.view !== null || r.smokingLabel !== null || r.bedrooms.length > 0 || photos > 0;
}

function RoomDetail({ room, photos, locale }: { room: RoomView; photos: RoomView["photos"]; locale: Locale }) {
  const t = messages(locale).accommodation.room;
  return (
    <>
      {photos.length > 0 && (
        <div className="-mx-2.5 mb-1 mt-2 flex snap-x gap-1.5 overflow-x-auto px-2.5">
          {photos.map((p, i) => p.url ? (
            <Image
              key={`${p.url}-${i}`}
              src={p.url}
              alt={room.label}
              width={1080}
              height={720}
              // 1 枚なら列の幅いっぱい、複数なら 78%（className の w-[78%]）。高さは 120px 固定で上下は切るので、実際の幅より大きい画像は取らない
              sizes={photos.length === 1 ? "(max-width: 480px) 100vw, 480px" : "(max-width: 480px) 78vw, 374px"}
              className={`block h-[120px] shrink-0 snap-start rounded-[10px] object-cover ${photos.length === 1 ? "w-full" : "w-[78%]"}`}
            />
          ) : null)}
        </div>
      )}
      {room.capacity !== null && <SubRow label={t.capacity} value={t.guests(room.capacity)} />}
      {room.areaSqm !== null && <SubRow label={t.size} value={t.sqm(room.areaSqm)} />}
      {room.tatami !== null && <SubRow label={t.tatamiLabel} value={t.tatami(room.tatami)} />}
      {room.styleLabel && <SubRow label={t.style} value={room.styleLabel} />}
      {room.view && <SubRow label={t.view} value={room.view} />}
      {room.smokingLabel && <SubRow label={t.smoking} value={room.smokingLabel} />}
      {room.bedrooms.map((b) => (
        <SubRow key={b.label} label={b.label} value={b.beds} />
      ))}
    </>
  );
}

// 「部屋」のカード。部屋ごとに 1 行、押すとその下に中身を開く
export function Rooms({ rooms, locale }: { rooms: RoomView[]; locale: Locale }) {
  if (!rooms.length) return null;
  return (
    <Card title={messages(locale).accommodation.title.rooms}>
      {rooms.map((r) => {
        const photos = r.photos.filter((p) => p.url && !p.isDemo);
        return (
          <ExpandRow key={r.key} label={r.label} value={roomSummary(r, locale)}>
            {hasMore(r, photos.length) ? <RoomDetail room={r} photos={photos} locale={locale} /> : undefined}
          </ExpandRow>
        );
      })}
    </Card>
  );
}
