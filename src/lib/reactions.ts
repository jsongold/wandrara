// 提案ページのカードへのリアクション（いいね・すごくいい・うーん）。場所（dest_id）ごとに 1 つ。
// 今はこのブラウザの localStorage にだけ持つ（ログインの人の保存・提案の並びへの反映は後で DB に移す）
export type Reaction = "good" | "great" | "hmm";
export const REACTIONS: Reaction[] = ["good", "great", "hmm"];
/** dest_id → リアクション */
export type Reactions = Readonly<Record<string, Reaction>>;

const isReaction = (v: unknown): v is Reaction => typeof v === "string" && (REACTIONS as string[]).includes(v);

/** 同じものを押したら外す。違うものなら置き換える */
export function react(map: Reactions, destId: string, r: Reaction): Reactions {
  const { [destId]: current, ...rest } = map;
  return current === r ? rest : { ...rest, [destId]: r };
}

/** 保存した文字列を読む。壊れていれば空、知らない値は捨てる */
export function parseReactions(raw: string | null): Reactions {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v).filter(([, r]) => isReaction(r)));
  } catch {
    return {};
  }
}
