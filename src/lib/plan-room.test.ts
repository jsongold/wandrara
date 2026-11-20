import { describe, expect, it } from "vitest";
import { roomData, type PlanCard } from "./plan-room";

const card = (destId: string, regionIds: string[], coreType: string, kindLabel: string): PlanCard =>
  ({ key: destId, destId, title: destId, areaLabel: "", kindLabel, relLabel: "", photos: [], href: "", carousel: [], regionIds, coreType, reason: [] }) as PlanCard;

describe("roomData", () => {
  it("カードから候補・条件・特徴の名前を作る", () => {
    const d = roomData(
      [card("a", ["ashinoko", "hakone"], "accommodation", "宿"), card("b", ["sengokuhara", "hakone"], "nature", "自然")],
      ["near_lake", "no_data"],
      { traits: [{ id: "lake", label: "湖畔", icon: "" }], byRegion: { ashinoko: ["lake"] } },
      [{ id: "hakone", label: "箱根", subs: [{ id: "ashinoko", label: "芦ノ湖" }, { id: "sengokuhara", label: "仙石原" }] }],
    );
    expect(d.candidates.map((c) => c.features)).toEqual([["trait:lake", "kind:accommodation", "area:ashinoko"], ["kind:nature", "area:sengokuhara"]]);
    expect(d.conditions).toEqual(["trait:lake"]);
    expect(d.labels).toMatchObject({ "trait:lake": "湖畔", "kind:accommodation": "宿", "area:sengokuhara": "仙石原" });
  });
});
