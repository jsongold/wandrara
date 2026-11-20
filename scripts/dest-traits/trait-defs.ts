// 特徴の定義表（docs/suggest/trait-candidates.tsv）を traits マスターの行にする（純関数）
// 列：id 名前 大分類 分類 対象 型 作り方 参考 2周目との相性
export type TraitDef = {
  id: string;
  name: string;
  big: string;
  sub: string;
  target: string; // 対象（全部・宿・体験・自然・建物・温泉 を「・」でつないだもの）
  valueType: "flag" | "number" | "level" | "enum";
  unit: string | null;
  source: "text" | "location" | "external" | "column" | "calc";
  method: string | null; // calc のときだけ（例 所要時間）
  reference: string;
  fit: string;
};

const SOURCES: Record<string, TraitDef["source"]> = { 紹介文: "text", 位置: "location", 外部データ: "external", 列: "column" };

/** 「number(m)」→ { valueType: number, unit: m }。level(0-3) は単位なし */
function parseType(raw: string): Pick<TraitDef, "valueType" | "unit"> {
  const m = /^(flag|number|level|enum)(?:\((.*)\))?$/.exec(raw);
  if (!m) throw new Error(`型を読めない: ${raw}`);
  const valueType = m[1] as TraitDef["valueType"];
  return { valueType, unit: valueType === "number" && m[2] ? m[2] : null };
}

function parseSource(raw: string): Pick<TraitDef, "source" | "method"> {
  const known = SOURCES[raw];
  if (known) return { source: known, method: null };
  const m = /^計算（(.*)）$/.exec(raw);
  if (m) return { source: "calc", method: m[1] };
  throw new Error(`作り方を読めない: ${raw}`);
}

export function parseTraitTsv(tsv: string): TraitDef[] {
  const [header, ...rows] = tsv.split("\n").filter((l) => l.trim() !== "");
  if (!header.startsWith("id\t")) throw new Error("先頭の行が列名ではない");
  const seen = new Set<string>();
  return rows.map((line, i) => {
    const c = line.split("\t");
    const [id, name, big, sub, target, type, how, reference = "", fit = ""] = c;
    if (!/^[a-z0-9_-]{1,40}$/.test(id ?? "")) throw new Error(`${i + 2} 行目の id が正しくない: ${id}`);
    if (seen.has(id)) throw new Error(`id が重なっている: ${id}`);
    seen.add(id);
    return { id, name, big, sub, target, ...parseType(type), ...parseSource(how), reference, fit };
  });
}

const q = (s: string | null) => (s === null ? "null" : `'${s.replaceAll("'", "''")}'`);

/**
 * traits に定義を入れる SQL。既にある行（onsen・plateau：source = items）は source・型などを変えず、定義表の列（big・sub・target・reference・fit）だけ埋める。
 * migration の中身はこの出力（pnpm dest-traits:seed-sql）。
 */
export function traitSeedSql(defs: TraitDef[]): string {
  const values = defs
    .map(
      (d) =>
        `  (${q(d.id)}, ${q(JSON.stringify({ ja: d.name }))}, ${q(d.valueType)}, ${q(d.unit)}, ${q(d.source)}, ${q(d.method)}, ${q(d.big)}, ${q(d.sub)}, ${q(d.target)}, ${q(d.reference)}, ${q(d.fit)})`,
    )
    .join(",\n");
  return [
    "insert into public.traits (id, name, value_type, unit, source, method, big, sub, target, reference, fit) values",
    values,
    "on conflict (id) do update set big = excluded.big, sub = excluded.sub, target = excluded.target, reference = excluded.reference, fit = excluded.fit, updated_at = now();",
  ].join("\n");
}

const CORE_BY_WORD: Record<string, string[]> = {
  宿: ["accommodation"],
  体験: ["experience"],
  自然: ["nature"],
  建物: ["building"],
  温泉: ["hotspring"],
};

/** 対象（宿・温泉 など）に、この種類の dest が入るか。「全部」はすべて */
export function appliesTo(target: string, coreType: string): boolean {
  return target.split("・").some((w) => w === "全部" || (CORE_BY_WORD[w] ?? []).includes(coreType));
}
