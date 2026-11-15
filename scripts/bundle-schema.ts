// bundle の JSON Schema を schema/content-bundle.schema.json に書く。
// 使い方: pnpm bundle:schema
import { writeFile } from "node:fs/promises";
import { bundleJsonSchema } from "../src/lib/ingest/bundle.ts";

const out = new URL("../schema/content-bundle.schema.json", import.meta.url);
await writeFile(out, JSON.stringify(bundleJsonSchema(), null, 2) + "\n");
console.log("wrote schema/content-bundle.schema.json");
