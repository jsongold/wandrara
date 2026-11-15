import type { ReactNode } from "react";
import type { AccommodationView } from "@/lib/accommodation/view";
import { PriceTable } from "./PriceTable";
import { Rooms } from "./Rooms";
import { Sources } from "./Sources";
import { Access, Amenities, Baths, Booking, Cautions, Conditions, Licenses, Meals, Parking, Pets, Surroundings } from "./Topics";

// 宿の詳細のトピックを決まった順に並べる。中身の無いトピックは各部品が出さない
// StayStrip は紹介文のすぐ下に置くので、ここには入れない（DestDetail が置く）
export function AccommodationSections({ view, map, note }: { view: AccommodationView; map?: ReactNode; note?: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      {view.priceTable && <PriceTable table={view.priceTable} />}
      <Rooms rooms={view.rooms} />
      <Meals meals={view.meals} />
      <Baths baths={view.baths} />
      <Amenities groups={view.amenityGroups} internet={view.internet} />
      <Pets pets={view.pets} />
      <Conditions conditions={view.conditions} />
      <Parking parking={view.parking} />
      <Access access={view.access} map={map} />
      <Surroundings surroundings={view.surroundings} />
      <Cautions cautions={view.cautions} />
      <Licenses licenses={view.licenses} />
      <Booking links={view.bookingLinks} />
      <Sources sources={view.sources} />
      {note && <p className="m-0 mt-1 text-xs leading-[1.7] text-[#55524a]">{note}</p>}
    </div>
  );
}
