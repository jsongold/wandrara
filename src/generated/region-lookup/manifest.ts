// 生成ファイル（pnpm area-map:build）。手で直さない
import type { LookupManifest, LookupShard } from "../../lib/region/types.ts";

export const LOOKUP_MANIFEST: LookupManifest = {
  "version": "lookup-3863944c3986",
  "sources": {
    "n03": "N03-2024",
    "estat": "estat-2020"
  },
  "prefectures": [
    {
      "code": "14",
      "name": "神奈川県",
      "bbox": [
        138.97416,
        35.17538,
        139.12122,
        35.2899
      ]
    },
    {
      "code": "22",
      "name": "静岡県",
      "bbox": [
        138.73799,
        34.57215,
        139.17655,
        35.18255
      ]
    }
  ],
  "parents": {
    "hakone": null,
    "yumoto": "hakone",
    "ashinoko": "hakone",
    "gora": "hakone",
    "sengokuhara": "hakone",
    "owakudani": "hakone",
    "izu": null,
    "ito": "izu",
    "shuzenji": "izu",
    "nakaizu": "izu",
    "shimoda": "izu",
    "nishiizu": "izu",
    "atami": "izu",
    "higashi-izu": "izu"
  },
  "points": [
    "owakudani"
  ]
};
