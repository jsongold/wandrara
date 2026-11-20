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

describe("roomData と dest_traits", () => {
  it("dest_traits にある条件は dest: の特徴になり、合うカードに理由が付く", () => {
    const d = roomData(
      [card("a", ["yumoto", "hakone"], "accommodation", "宿"), card("b", ["yumoto", "hakone"], "accommodation", "宿")],
      ["kakenagashi", "onsen"],
      { traits: [{ id: "onsen", label: "温泉", icon: "" }], byRegion: { yumoto: ["onsen"] } },
      [],
      { a: ["kakenagashi"] },
    );
    expect(d.conditions).toEqual(["dest:kakenagashi", "trait:onsen"]);
    expect(d.cards.map((c) => c.reason)).toEqual([["源泉かけ流し", "温泉"], ["温泉"]]);
    expect(d.labels["dest:kakenagashi"]).toBe("源泉かけ流し");
  });
});
