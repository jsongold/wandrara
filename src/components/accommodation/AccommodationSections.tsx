import type { ReactNode } from "react";
import type { AccommodationView } from "@/lib/accommodation/view";
import type { Locale } from "@/lib/types";
import { PriceTable } from "./PriceTable";
import { Rooms } from "./Rooms";
import { Sources } from "./Sources";
import { Access, Amenities, Baths, Booking, Cautions, Conditions, Licenses, Meals, Parking, Pets, Surroundings } from "./Topics";

// 宿の詳細のトピックを決まった順に並べる。中身の無いトピックは各部品が出さない
// StayStrip は紹介文のすぐ下に置くので、ここには入れない（DestDetail が置く）
export function AccommodationSections({
  view,
  map,
  note,
  locale,
}: {
  view: AccommodationView;
  map?: ReactNode;
  note?: string;
  locale: Locale;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {view.priceTable && <PriceTable table={view.priceTable} locale={locale} />}
      <Rooms rooms={view.rooms} locale={locale} />
      <Meals meals={view.meals} locale={locale} />
      <Baths baths={view.baths} locale={locale} />
      <Amenities groups={view.amenityGroups} internet={view.internet} locale={locale} />
      <Pets pets={view.pets} locale={locale} />
      <Conditions conditions={view.conditions} locale={locale} />
      <Parking parking={view.parking} locale={locale} />
      <Access access={view.access} map={map} locale={locale} />
      <Surroundings surroundings={view.surroundings} locale={locale} />
      <Cautions cautions={view.cautions} locale={locale} />
      <Licenses licenses={view.licenses} locale={locale} />
      <Booking links={view.bookingLinks} locale={locale} />
      <Sources sources={view.sources} locale={locale} />
      {note && <p className="m-0 mt-1 text-xs leading-[1.7] text-[#55524a]">{note}</p>}
    </div>
  );
}
