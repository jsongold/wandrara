// 提案の評価で回すシナリオ：グループ・人（ペルソナ）。誰が（who）・どんな経験をしたいか（want）と、
// その人たちが WANDRARA の画面で選びそうな条件（query：/api/propose-eval と提案ページの URL の値 t・area・p・m・o）。
// 評価の主役は「この人たちに合った経験を提案できたか」（LLM が採点）。scripts/propose-eval が GET /api/propose-eval/scenarios で読む
export type Scenario = { id: string; who: string; want: string; query: Record<string, string> };

export const SCENARIOS: Scenario[] = [
  { id: "anniversary-couple", who: "30 代の夫婦", want: "結婚記念日に、静かな宿で温泉にゆっくり浸かりたい。", query: { t: "anniversary,quiet,room_rotenburo", p: "2" } },
  { id: "kids-family", who: "5 歳と 8 歳の子連れ家族 4 人", want: "子どもが自然の中で思い切り遊べて、親も温泉でひと息つきたい。", query: { t: "river_play,onsen", o: "kids", p: "4" } },
  { id: "three-generations", who: "70 代の両親と 40 代の娘", want: "両親が無理なく歩ける範囲で、紅葉と温泉を楽しみたい。", query: { t: "onsen,seniors", m: "11", p: "3" } },
  { id: "dog-couple", who: "犬連れのカップル", want: "犬と一緒に海辺を散歩して、同じ部屋に泊まりたい。", query: { t: "near_sea,beach_walk", o: "pets", p: "2" } },
  { id: "solo-work", who: "ひとり旅・仕事も少し（30 代）", want: "平日に静かな宿で少し仕事をしながら、温泉で頭を休めたい。", query: { t: "workspace,quiet,onsen", o: "solo", p: "1" } },
  { id: "uni-friends", who: "大学の友人 5 人（20 代）", want: "一棟貸しでわいわい過ごし、サウナと焚き火で夜更かししたい。", query: { t: "kind_private_rental,sauna,bonfire", p: "5" } },
  { id: "hiker-couple", who: "40 代の山好きの夫婦", want: "箱根の山を歩いて、夜は地元の食材の夕食を食べたい。", query: { t: "hiking,local_food", area: "hakone", p: "2" } },
  { id: "stars-couple", who: "20 代のカップル", want: "星空と焚き火で、自然の中の非日常を味わいたい。", query: { t: "dark_sky,stargazing,bonfire", p: "2" } },
  { id: "senior-couple-izu", who: "60 代の夫婦（車なし・電車で行く）", want: "伊豆で海の見える宿に泊まり、古い温泉街をのんびり歩きたい。", query: { t: "sea_view,onsen_town,train_access", area: "izu", p: "2" } },
  { id: "women-friends", who: "30 代の女友だち 3 人", want: "紅葉の季節に、写真に残したくなる景色とおいしい食事を楽しみたい。", query: { t: "autumn_leaves,photo_walk,local_food", m: "11", p: "3" } },
  { id: "wheelchair-family", who: "車いすの父（70 代）と家族 3 人", want: "段差を気にせず、景色の良い温泉に父と一緒に入りたい。", query: { t: "onsen,view_bath", o: "barrier_free", p: "3" } },
];
