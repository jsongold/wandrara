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
    // 詳細は details の JSON に持つ（詳細の表は無い）
    details: {},
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
    // 詳細は details の JSON に持つ（詳細の表は無い）
    details: {},
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
    // 詳細は details の JSON に持つ（詳細の表は無い）
    details: {},
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
    // 詳細は details の JSON に持つ（詳細の表は無い）
    details: {},
  },
  hotspring: {
    label: "Hot spring",
    columns: { kind: "Type", officialUrl: "Official website" },
    kindLabels: { day_use: "Day-use hot spring", public_bath: "Public bath", foot_bath: "Foot bath" },
    // 詳細は details の JSON に持つ（詳細の表は無い）
    details: {},
  },
};
