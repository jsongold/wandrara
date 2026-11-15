import type { RoomView } from "@/lib/accommodation/view";
import { ExpandRow, SubRow } from "../ExpandRow";
import { Card } from "./Card";
import { roomSummary } from "./format";

// 行の値に出ていないこと（眺望・喫煙・写真・寝室ごとのベッド）があるときだけ開ける
function hasMore(r: RoomView, photos: number): boolean {
  return r.view !== null || r.smokingLabel !== null || r.bedrooms.length > 1 || photos > 0;
}

function RoomDetail({ room, photos }: { room: RoomView; photos: RoomView["photos"] }) {
  return (
    <>
      {photos.length > 0 && (
        <div className="-mx-2.5 mb-1 mt-2 flex snap-x gap-1.5 overflow-x-auto px-2.5">
          {photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${p.url}-${i}`}
              src={p.url ?? ""}
              alt={room.label}
              loading="lazy"
              decoding="async"
              className={`block h-[120px] shrink-0 snap-start rounded-[10px] object-cover ${photos.length === 1 ? "w-full" : "w-[78%]"}`}
            />
          ))}
        </div>
      )}
      {room.capacity !== null && <SubRow label="定員" value={`${room.capacity} 名`} />}
      {room.areaSqm !== null && <SubRow label="広さ" value={`${room.areaSqm}㎡`} />}
      {room.tatami !== null && <SubRow label="畳" value={`${room.tatami} 畳`} />}
      {room.styleLabel && <SubRow label="種類" value={room.styleLabel} />}
      {room.view && <SubRow label="眺望" value={room.view} />}
      {room.smokingLabel && <SubRow label="喫煙" value={room.smokingLabel} />}
      {room.bedrooms.map((b) => (
        <SubRow key={b.label} label={b.label} value={b.beds} />
      ))}
    </>
  );
}

// 「部屋」のカード。部屋ごとに 1 行、押すとその下に中身を開く
export function Rooms({ rooms }: { rooms: RoomView[] }) {
  if (!rooms.length) return null;
  return (
    <Card title="部屋">
      {rooms.map((r) => {
        const photos = r.photos.filter((p) => p.url && !p.isDemo);
        return (
          <ExpandRow key={r.key} label={r.label} value={roomSummary(r)}>
            {hasMore(r, photos.length) ? <RoomDetail room={r} photos={photos} /> : undefined}
          </ExpandRow>
        );
      })}
    </Card>
  );
}
