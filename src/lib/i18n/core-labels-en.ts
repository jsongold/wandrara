// 項目名・種類の英語。日本語の正本は src/db/schema/*.ts の CoreDef（label・columns・kindLabels・details）。
// 形は CoreDef と同じ（core_type → label / columns / kindLabels / details[key]）。抜けはテストで見つける
export type CoreLabelsEn = Record<
  string,
  {
    label: string;
    columns: Record<string, string>;
    kindLabels: Record<string, string>;
    details: Record<string, { label: string; columns: Record<string, string> }>;
  }
>;

const BOOKING = { label: "Booking", columns: { label: "Name", url: "URL", isOfficial: "Official" } };
const CAUTIONS = { label: "Cautions", columns: { kind: "Type", note: "Details" } };

export const CORE_LABELS_EN: CoreLabelsEn = {
  accommodation: {
    label: "Stay",
    columns: { kind: "Type", checkIn: "Check-in", checkOut: "Check-out", officialUrl: "Official website" },
    kindLabels: {
      hotel: "Hotel",
      ryokan: "Ryokan",
      private_rental: "Private rental",
      minshuku: "Minshuku",
      pension: "Pension",
      glamping: "Glamping",
      campsite: "Campsite",
    },
    // 宿の詳細は details の JSON に持つ（詳細の表は無い）
    details: {},
  },
  experience: {
    label: "Experience",
    columns: { kind: "Type", regionId: "Area", durationMinutes: "Duration (min)", reservationRequired: "Reservation required", officialUrl: "Official website" },
    kindLabels: {
      tour: "Tour",
      workshop: "Workshop",
      tasting: "Tasting",
      activity: "Activity",
      facility_use: "Facility use",
      event: "Event",
    },
    details: {
      courses: {
        label: "Course",
        columns: {
          name: "Name",
          description: "Description",
          durationMinutes: "Duration (min)",
          minPeople: "Min. people",
          maxPeople: "Max. people",
          minAge: "Min. age",
          languages: "Guide languages",
        },
      },
      prices: {
        label: "Price",
        columns: { courseId: "Course", unit: "Per", audience: "For", amount: "Amount", amountMax: "Amount (max)", currency: "Currency", note: "Note" },
      },
      schedules: {
        label: "Schedule",
        columns: { startMonth: "From month", endMonth: "To month", weekdays: "Days", startTime: "Starts", endTime: "Ends", rainPolicy: "If it rains" },
      },
      locations: {
        label: "Location",
        columns: { kind: "Type", lat: "Latitude", lng: "Longitude", geoPrecision: "Location accuracy", address: "Address" },
      },
      inclusions: { label: "What's included", columns: { kind: "Type", item: "Item" } },
      cautions: CAUTIONS,
      booking_links: BOOKING,
    },
  },
  nature: {
    label: "Nature",
    columns: { kind: "Type", protection: "Protection status" },
    kindLabels: {
      coast: "Coast",
      mountain: "Mountain",
      lake: "Lake",
      highland: "Highland",
      gorge: "Gorge",
      waterfall: "Waterfall",
      forest: "Forest",
      volcano: "Volcano",
    },
    details: {
      seasons: { label: "Best season", columns: { subject: "What", monthFrom: "From month", monthTo: "To month" } },
      hours_fees: {
        label: "Hours and fees",
        columns: { openTime: "Opens", closeTime: "Closes", closedNote: "Closed", amount: "Fee", currency: "Currency" },
      },
      access: {
        label: "Getting there",
        columns: { hasParking: "Parking", parkingNote: "Parking note", nearestStation: "Nearest station", walkMinutes: "Walk (min)" },
      },
      trails: {
        label: "Trail",
        columns: { name: "Name", distanceKm: "Distance (km)", elevationGainM: "Elevation gain (m)", difficulty: "Difficulty", durationMinutes: "Duration (min)" },
      },
      restrictions: { label: "Access restrictions", columns: { kind: "Type", note: "Details", dateFrom: "From", dateTo: "Until" } },
      cautions: CAUTIONS,
    },
  },
  village: {
    label: "Village",
    columns: { kind: "Type", regionId: "Area", municipality: "Municipality" },
    kindLabels: {
      onsen_town: "Hot spring town",
      post_town: "Post town",
      fishing_village: "Fishing village",
      temple_town: "Temple town",
      castle_town: "Castle town",
    },
    details: {
      walks: { label: "Walking area", columns: { area: "Area", durationMin: "Duration (min)" } },
      shop_hours: { label: "Shop hours", columns: { opensAt: "Opens", closesAt: "Closes", note: "Note" } },
      access: { label: "Getting there", columns: { kind: "Type", note: "Note" } },
      events: { label: "Festivals and events", columns: { name: "Name", season: "Season", note: "Note" } },
      cautions: { label: "Cautions", columns: { kind: "Type", note: "Note" } },
    },
  },
  building: {
    label: "Building",
    columns: { kind: "Type", officialUrl: "Official website" },
    kindLabels: {
      museum: "Museum",
      shrine: "Shrine",
      temple: "Temple",
      castle: "Castle",
      observatory: "Observation deck",
      historic_building: "Historic building",
    },
    details: {
      hours: { label: "Opening hours", columns: { openTime: "Opens", closeTime: "Closes", closedDays: "Closed on", note: "Note" } },
      fees: { label: "Admission", columns: { label: "Type", amount: "Fee", amountMax: "Fee (max)", currency: "Currency", note: "Note" } },
      access: {
        label: "Getting there",
        columns: { howToGet: "How to get there", hasParking: "Parking", parkingCapacity: "Parking spaces", parkingNote: "Parking note" },
      },
      events: {
        label: "Exhibitions and events",
        columns: { name: "Name", startDate: "Starts", endDate: "Ends", season: "Season", note: "Note" },
      },
      cautions: CAUTIONS,
    },
  },
  hotspring: {
    label: "Hot spring",
    columns: { kind: "Type", officialUrl: "Official website" },
    kindLabels: { day_use: "Day-use hot spring", public_bath: "Public bath", foot_bath: "Foot bath" },
    details: {
      baths: { label: "Bath", columns: { bathType: "Type", springHandling: "Hot spring water", springQuality: "Spring type", note: "Note" } },
      hours: { label: "Opening hours", columns: { opensAt: "Opens", closesAt: "Closes", closedDays: "Closed on", note: "Note" } },
      fees: { label: "Fees", columns: { feeKind: "Type", amount: "Amount", amountMax: "Amount (max)", currency: "Currency", note: "Note" } },
      amenities: { label: "Amenities", columns: { towel: "Towels", restArea: "Rest area", meal: "Food", note: "Note" } },
      access: { label: "Getting there", columns: { nearestStation: "Nearest station", parking: "Parking", parkingCapacity: "Parking spaces", note: "Note" } },
      cautions: CAUTIONS,
    },
  },
};
