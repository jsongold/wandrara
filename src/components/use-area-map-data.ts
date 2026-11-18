"use client";

// 地図のデータを読む。開いたときに土台（陸地と親エリア）、寄せたら見えている親の子を後から読む（一度読んだものは覚える）
import { useEffect, useState } from "react";
import type { AreaMapBase, AreaMapChildren } from "@/lib/area-map";
import { showChildren, visibleParents } from "@/lib/area-map-visible";
import { shownView, type View } from "@/lib/pan-zoom";
import { AREA_MAP_CHILDREN, loadAreaMapBase } from "@/generated/area-map";

export function useAreaMapBase(): AreaMapBase | null {
  const [base, setBase] = useState<AreaMapBase | null>(null);
  useEffect(() => {
    let alive = true;
    loadAreaMapBase().then((b) => {
      if (alive) setBase(b);
    });
    return () => {
      alive = false;
    };
  }, []);
  return base;
}

/** 子を出す寄り方なら、見えている親の子（読み終わったもの）。zoomed は子を出す寄り方か */
export function useAreaMapChildren(base: AreaMapBase | null, view: View | null, start: View | null, box: { w: number; h: number } | null): { zoomed: boolean; children: AreaMapChildren[] } {
  const [loaded, setLoaded] = useState<Record<string, AreaMapChildren>>({});
  const zoomed = !!(base && view && start && showChildren(view, start));
  const want = zoomed ? visibleParents(base!.parents, box ? shownView(view!, box) : view!).filter((id) => AREA_MAP_CHILDREN[id]) : [];
  const key = want.join(",");

  useEffect(() => {
    if (!key) return;
    let alive = true;
    for (const id of key.split(",")) {
      AREA_MAP_CHILDREN[id]().then((c) => {
        if (alive) setLoaded((m) => (m[id] ? m : { ...m, [id]: c }));
      });
    }
    return () => {
      alive = false;
    };
  }, [key]);

  return { zoomed, children: want.map((id) => loaded[id]).filter((c): c is AreaMapChildren => !!c) };
}
