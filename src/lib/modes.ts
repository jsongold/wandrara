// トップの切り替え。宿（stay）と体験（do）が、どの core_type を出すか
export const MODES = {
  stay: ["accommodation"],
  do: ["experience", "nature", "village", "building", "hotspring"],
} as const;

export type Mode = keyof typeof MODES;

export const MODE_LABEL: Record<Mode, string> = { stay: "宿", do: "体験" };

export const MODE_IDS = Object.keys(MODES) as Mode[];

export function otherMode(mode: Mode): Mode {
  return mode === "stay" ? "do" : "stay";
}
