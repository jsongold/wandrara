// 一言：きっかけと、選んだ候補に一番効いた特徴から作る。文面（言語）と特徴の名前は外から渡す。
// LLM に替えるときは、同じ LeadInput を受け取る LeadWriter を作り、guardedLead で包む
import type { FeatureId, LeadInput, LeadWriter } from "./types";

export type LeadText = {
  start: (n: number) => string;
  choice: (label: string) => string;
  great: (name: string, label: string | null) => string;
  good: (name: string, label: string | null) => string;
  hmm: (name: string) => string;
  next: () => string;
  end: () => string;
};

export function templateLead(text: LeadText, labelOf: (f: FeatureId) => string, name = "lead-template@1"): LeadWriter {
  return {
    name,
    write({ cause, picked, topFeature }: LeadInput) {
      if (!picked.length) return text.end();
      const label = topFeature ? labelOf(topFeature) : null;
      switch (cause.type) {
        case "start":
          return text.start(picked.length);
        case "choice":
          return text.choice(labelOf(cause.feature));
        case "reaction":
          if (cause.reaction === "great") return text.great(cause.name, label);
          if (cause.reaction === "good") return text.good(cause.name, label);
          return text.hmm(cause.name);
        default:
          return text.next();
      }
    },
  };
}

/**
 * 書き手の出力を検査し、通らなければ fallback（テンプレート）の一言にする。
 * 検査：空でない・maxLength 以内・選んだ候補に無い場所の名前（knownNames のうち候補に無いもの）を出していない
 */
export function guardedLead(writer: LeadWriter, fallback: LeadWriter, knownNames: string[], maxLength = 80): LeadWriter {
  return {
    name: `${writer.name}|${fallback.name}`,
    write(input) {
      let out: string;
      try {
        out = writer.write(input).trim();
      } catch {
        return fallback.write(input);
      }
      const inPicked = new Set(input.picked.map((c) => c.name));
      const mentionsOther = knownNames.some((n) => !inPicked.has(n) && (input.cause.type !== "reaction" || n !== input.cause.name) && out.includes(n));
      return out && out.length <= maxLength && !mentionsOther ? out : fallback.write(input);
    },
  };
}
