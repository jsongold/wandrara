// 地図に何を載せるかをメソッドの足し引きで決める。
//   nearbyMap({ span: 0.8 }).green().water().roads().rail().stations({ limit: 3 })
// 呼んだ順に下から重ねる。呼ばなかったものは描かず、その層の区画データも読まない。
// 中身はただのデータ（NearbySpec）なので、そのままキャッシュのキーになる。
import type { PathLayerKey, PlaceKey } from "./layers";

export type NearbySpec = {
  /** 枠の横幅（区画何個分。ズーム 14 の区画は日本で横約 2km） */
  span: number;
  layers: PathLayerKey[];
  places: { kind: PlaceKey; limit: number }[];
};

export class NearbyMapSpec {
  constructor(readonly spec: NearbySpec) {}

  private layer(k: PathLayerKey) {
    return new NearbyMapSpec({ ...this.spec, layers: [...this.spec.layers, k] });
  }
  private place(kind: PlaceKey, limit: number) {
    return new NearbyMapSpec({ ...this.spec, places: [...this.spec.places, { kind, limit }] });
  }

  /** 森・草地・公園 */
  green() {
    return this.layer("green");
  }
  /** 海・湖・川 */
  water() {
    return this.layer("water");
  }
  /** 車の通る道（小道・階段は出さない） */
  roads() {
    return this.layer("roads");
  }
  /** 線路 */
  rail() {
    return this.layer("rail");
  }
  /** 近くの駅を近い順に limit 件（地図に印、下に名前と距離） */
  stations({ limit = 3 }: { limit?: number } = {}) {
    return this.place("stations", limit);
  }
}

export function nearbyMap({ span = 0.8 }: { span?: number } = {}): NearbyMapSpec {
  return new NearbyMapSpec({ span, layers: [], places: [] });
}
