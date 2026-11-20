// 提案シートの語彙：こだわり（大分類 > 分類 > キーワード）とおすすめ。
// キーワードの一覧は docs/suggest/trait-candidates.tsv から作った src/generated/trait-taxonomy.json（dest_traits の候補）。
// 値を持つキーワードは今はエリアの特性（traits）と dest の種類（core_type）だけ。dest_traits ができたら MATCH を差し替える
import taxonomy from "@/generated/trait-taxonomy.json";

export type Keyword = { id: string; label: string; big: string; sub: string };

/** キーワードの値の出どころ。trait はカードの地区の特性、core は dest の種類 */
export type KeywordSource = { trait: string } | { core: string };

const KINDS: Keyword[] = [
  { id: "kind-village", label: "温泉地・村", big: "行き先の種類", sub: "種類" },
  { id: "kind-nature", label: "自然スポット", big: "行き先の種類", sub: "種類" },
  { id: "kind-experience", label: "体験", big: "行き先の種類", sub: "種類" },
  { id: "kind-hotspring", label: "日帰りの湯", big: "行き先の種類", sub: "種類" },
  { id: "kind-building", label: "建物", big: "行き先の種類", sub: "種類" },
];

export const KEYWORDS: Keyword[] = [...(taxonomy as Keyword[]), ...KINDS];

/** 値を持つキーワード（キーワード id → 出どころ）。ここに無いキーワードは「まだ数えられない」 */
export const MATCH: Record<string, KeywordSource> = {
  near_lake: { trait: "lake" },
  near_sea: { trait: "coast" },
  plateau: { trait: "plateau" },
  onsen: { trait: "onsen" },
  hiking: { trait: "hike" },
  "kind-village": { core: "village" },
  "kind-nature": { core: "nature" },
  "kind-experience": { core: "experience" },
  "kind-hotspring": { core: "hotspring" },
  "kind-building": { core: "building" },
};

export type Preset = { id: string; text: string; keywords: string[]; season?: string };

/** おすすめ。旬（season）は今は 11 月に合わせて手で付けている */
export const PRESETS: Preset[] = [
  { id: "forest-quiet", text: "森の中で静かに過ごす", keywords: ["forest", "quiet", "small_inn"] },
  { id: "sea-sauna", text: "海沿いでサウナを楽しむ", keywords: ["near_sea", "sauna", "outdoor_rest"] },
  { id: "lake-morning", text: "湖のほとりで朝を迎える", keywords: ["near_lake", "sunrise_view", "terrace"] },
  { id: "plateau-walk", text: "高原のすすきを歩く", keywords: ["plateau", "walking"], season: "11月の旬" },
  { id: "kakenagashi", text: "源泉かけ流しの湯にこもる", keywords: ["onsen", "kakenagashi", "private_bath"] },
  { id: "gorge-leaves", text: "渓谷で紅葉を見る", keywords: ["near_gorge", "autumn_leaves", "near_river"], season: "11月の旬" },
  { id: "onsen-town", text: "古い温泉街をそぞろ歩く", keywords: ["kind-village", "onsen_town", "walking"] },
  { id: "hike-dinner", text: "山歩きのあと、地元の食材で夕食", keywords: ["hiking", "local_food", "dinner"] },
  { id: "solo-toji", text: "ひとりで湯治", keywords: ["solo_ok", "toji_culture", "onsen"] },
  { id: "stars-fire", text: "星空と焚き火の夜", keywords: ["dark_sky", "stargazing", "bonfire"] },
];

const byId = new Map(KEYWORDS.map((k) => [k.id, k]));
export const keywordOf = (id: string): Keyword | undefined => byId.get(id);

/** 大分類の並び（候補表の順） */
export const BIG_CATEGORIES: string[] = [...new Set(KEYWORDS.map((k) => k.big))];
