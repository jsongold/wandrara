// 地図に何を載せるかをメソッドの足し引きで決める。
//   nearbyMap({ zoom: 15 }).green().water().roads().rail().buildings().placeNames().stations().pois()
// 呼ばなかったものは地図に出さない（重ね順は地図の定義どおり）。
// 中身はただのデータ（NearbySpec）なので、サーバーの部品からブラウザの部品へそのまま渡せる。
import type { GroupKey } from "./layers";

export type NearbySpec = {
  /** 開いたときの寄せ具合（ズーム） */
  zoom: number;
  groups: GroupKey[];
};

export class NearbyMapSpec {
  constructor(readonly spec: NearbySpec) {}

  private add(k: GroupKey) {
    return new NearbyMapSpec({ ...this.spec, groups: [...this.spec.groups, k] });
  }

  /** 森・草地・公園 */
  green() {
    return this.add("green");
  }
  /** 海・湖・川 */
  water() {
    return this.add("water");
  }
  /** 道と道の名前 */
  roads() {
    return this.add("roads");
  }
  /** 線路 */
  rail() {
    return this.add("rail");
  }
  /** 建物 */
  buildings() {
    return this.add("buildings");
  }
  /** 町・地区の名前 */
  placeNames() {
    return this.add("placeNames");
  }
  /** 駅 */
  stations() {
    return this.add("stations");
  }
  /** お店・名所など */
  pois() {
    return this.add("pois");
  }
}

export function nearbyMap({ zoom = 15 }: { zoom?: number } = {}): NearbyMapSpec {
  return new NearbyMapSpec({ zoom, groups: [] });
}
