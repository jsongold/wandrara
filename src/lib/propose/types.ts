// 提案フェーズ（ステージングのチャットルーム）の型。
// 特徴は文字列の id だけで扱い、出どころ（地区の特性・種類・地区・dest_traits）は features.ts だけが知る
import type { Reaction, Reactions } from "../reactions";

/** 特徴の id。例："trait:lake"・"kind:village"・"area:ashinoko"・"dest:quiet"（dest_traits） */
export type FeatureId = string;

/** 候補 1 件（場所）。features 以外の中身は見ない */
export type Candidate = { id: string; name: string; features: FeatureId[] };

/** 選んだ選択肢と、それを選んだ回 */
export type ChoicePick = { feature: FeatureId; round: number };

/** ルームの状態。round は出した回の数（0 はまだ何も出していない） */
export type ProposeState = {
  conditions: FeatureId[];
  reactions: Reactions;
  choices: ChoicePick[];
  shown: string[];
  round: number;
};

/** 次の回を作るきっかけ */
export type Cause =
  | { type: "start" }
  | { type: "next" }
  | { type: "choice"; feature: FeatureId }
  | { type: "reaction"; reaction: Reaction; id: string; name: string };

/** 特徴ごとの好みの重み（無いものは 0） */
export type Weights = ReadonlyMap<FeatureId, number>;

/** 次に出す選択肢。split はその特徴を持つ候補の割合 */
export type Choice = { feature: FeatureId; split: number };

/** 一言の材料（テンプレートでも LLM でも同じものを受け取る） */
export type LeadInput = { cause: Cause; picked: Candidate[]; topFeature: FeatureId | null };

/** 戦略の共通部分。name は「名前@版」 */
export type Strategy = { readonly name: string };
export type PickContext = { state: ProposeState; featuresOf: (id: string) => FeatureId[] };

export type Preference = Strategy & { weigh(ctx: PickContext): Weights };
export type Picker = Strategy & { pick(pool: Candidate[], weights: Weights, ctx: PickContext): string[] };
export type Chooser = Strategy & { choose(pool: Candidate[], weights: Weights, ctx: PickContext): Choice[] };
export type LeadWriter = Strategy & { write(input: LeadInput): string };

export type Strategies = { preference: Preference; picker: Picker; chooser: Chooser; lead: LeadWriter };

/** 1 回分の結果。done は出せる候補が無くなった */
export type RoundResult = {
  ids: string[];
  lead: string;
  leadInput: LeadInput;
  choices: Choice[];
  algorithm: string;
  done: boolean;
};
