// traits に 463 件の定義を入れる SQL を標準出力に出す（migration の中身を作るもの）。使い方: pnpm dest-traits:seed-sql
import fs from "node:fs";
import { parseTraitTsv, traitSeedSql } from "./trait-defs.ts";

const defs = parseTraitTsv(fs.readFileSync(new URL("../../docs/suggest/trait-candidates.tsv", import.meta.url), "utf8"));
console.log(traitSeedSql(defs));
