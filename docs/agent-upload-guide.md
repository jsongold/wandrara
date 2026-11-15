Purpose: how an agent uploads data to WANDRARA — how to run the script, and which resources go where in which schema.

# WANDRARA Data Upload Guide for Agents

To add data to WANDRARA, prepare a bundle (JSON) and its photos, then run `pnpm import:bundle`. Uploaded data is saved as a draft and appears on the site after the WANDRARA team reviews and publishes it.

## Using the script

Get an API key (a string starting with `wdr_`) from the WANDRARA team. The script runs on Node 24 and pnpm 10.

```sh
git clone https://github.com/jsongold/wandrara
cd wandrara
pnpm install --frozen-lockfile

export WANDRARA_API_URL=https://wandrara.vercel.app
export WANDRARA_API_KEY=wdr_...

pnpm import:bundle <bundle.json> --dry-run   # check the shape and photos only; nothing is sent
pnpm import:bundle <bundle.json>             # upload photos and register each dest as a draft
```

| Output | Meaning |
| --- | --- |
| `dry-run: dest N 件 / 写真 N 枚を確認した` | Shape and photos are fine. Nothing has been sent yet |
| `draft: <ref> → /d/<slug>` | Registered as a draft. Once published it appears at https://wandrara.vercel.app/d/<slug> |
| `bundle が正しくない:` followed by a list | The bundle has shape errors. Fix each path in the list (e.g. `/dests/0/core/kind`) |
| `error: <ref>: <reason>` | That dest was not registered. Fix it and run again |

Sending the same `ref` again updates the same dest (a published dest goes back to draft). If any dest fails, the exit code is 1.

## Resources and where they go

| Resource | Location | Format |
| --- | --- | --- |
| API key | env var `WANDRARA_API_KEY` | `wdr_...`. Never write it to a file or commit it to git |
| Endpoint | env var `WANDRARA_API_URL` | `https://wandrara.vercel.app` |
| Bundle | any folder (e.g. `data/hakone-01/bundle.json`) | JSON, see "Bundle schema" below |
| Photos | a path relative to the bundle (e.g. `data/hakone-01/images/001.jpg`) or an image URL | jpeg / png / webp / avif, up to 10 MB each |

```
data/hakone-01/
├ bundle.json
└ images/
  ├ 001.jpg
  └ 002.jpg
```

The full schema (JSON Schema) is in [`schema/content-bundle.schema.json`](../schema/content-bundle.schema.json).

## Bundle schema

A bundle is one JSON object. At the top level it has `bundle_version` (always `"2"`), `collector` (the agent's name), `collected_at` (ISO 8601) and `dests`, which lists one place per entry (a stay, an experience, ...). Column keys are snake_case; unknown keys are rejected.

One entry in `dests`:

| Field | Required | Content |
| --- | --- | --- |
| `core_type` | yes | accommodation / experience / nature / village / building / hotspring |
| `ref` | yes | The source's ID (e.g. `WR-atami-008`). The same ref updates the same dest |
| `slug` | no | The URL name (lowercase letters, digits, hyphens; 3–60 chars). Derived from ref if omitted. Never changes for an existing dest |
| `core` | yes | Columns of the core table (kind, location, official URL, ...) |
| `texts` | yes | Per language: `lang`, `name` (required), `summary`, `address` |
| `details` | no | Arrays per detail key (next section) |
| `categories` | no | Array of category ids. Unknown ids are created |
| `photos` | no | Photos (see "Photo upload") |
| `region` | no | `{id, name, parent_id}`. Created when `core.region_id` is not in the DB yet |
| `sources` | no | Array of sources (`type`, `url`, `retrieved_at`, `evidence`). Not stored as columns; kept in the raw import record |
| `verification_status` | no | verified / unverified / conflict. Kept in the raw import record |

Do not write `dest_id`, `id`, `sort` or `operator_id` (`sort` follows array order). Columns that point from a nested child to its parent, or from one detail to another (such as `unit_id` on accommodation prices or baths), are not accepted for now.

## core and details per core type

Each `core_type` has its own `core` columns and `details` keys. Core types with a location can also take `region_id`, `prefecture`, `municipality`, `district`, `lat`, `lng` and `geo_precision` (exact / street / district / municipality) in `core`.

| core_type | kind values | Main core columns | details keys (main columns) |
| --- | --- | --- | --- |
| accommodation | hotel, ryokan, private_rental, minshuku, pension, glamping, campsite | kind, check_in, check_out, official_url | units(name, capacity, area_sqm, style) > bedrooms > beds(bed_type, count) / baths / meals / booking_links / prices(amount, currency, guests, meals, valid_from, valid_to, tax_included) / amenities / parkings / internet / rules / access / surroundings / cautions / licenses |
| experience | tour, workshop, tasting, activity, facility_use, event | kind, region_id, duration_minutes, reservation_required, official_url | courses / prices(unit, audience, amount, currency) / schedules / locations / inclusions / cautions / booking_links |
| nature | coast, mountain, lake, highland, gorge, waterfall, forest, volcano | kind, protection | seasons / hours_fees / access / trails(name, distance_km, difficulty) / restrictions / cautions |
| village | onsen_town, post_town, fishing_village, temple_town, castle_town | kind, region_id, municipality | walks / shop_hours / access / events / cautions |
| building | museum, shrine, temple, castle, observatory, historic_building | kind, official_url | hours / fees(label, amount, currency) / access / events / cautions |
| hotspring | day_use, public_bath, foot_bath | kind, official_url | baths(bath_type, spring_handling, spring_quality) / hours / fees(fee_kind, amount, currency) / amenities / access / cautions |

Write nested children inside the parent row as an array under the child's key (e.g. `units[].bedrooms[].beds[]`). Free text (cautions, notes) is `{"ja": "...", "en": "..."}`, times are `HH:MM`, dates are `YYYY-MM-DD`, and amounts are numbers.

## Photo upload

List each photo in `photos`. `pnpm import:bundle` does the upload, so you do not need to host the images anywhere.

| Field | Required | Content |
| --- | --- | --- |
| `file` or `url` | exactly one | `file` is a path relative to the bundle JSON (e.g. `images/001.jpg`). `url` is an image file URL (downloaded at import time; the original URL is kept on record) |
| `license` | no | Terms of use. `none` if unknown |
| `source_page_url` | no | The page the image appeared on |
| `credit` | no | Photographer or provider |
| `subject` | no | exterior / room / bath / view / food / activity / landscape / other |
| `alt` | no | Image description, `{"ja": "..."}` |

Accepted formats are jpeg, png, webp and avif, up to 10 MB each. The format is detected from the file contents, not the extension. Images that are only placed in `images/` are not used — list every image you want in `photos`.

If any photo of a dest cannot be read or uploaded, that dest is not registered and an `error:` line is printed. Other dests continue.

## Example (one stay)

With `data/atami-01/bundle.json` and `data/atami-01/images/001.jpg` in place:

```json
{
  "bundle_version": "2",
  "collector": "hotel-collector",
  "collected_at": "2026-11-15T10:00:00+09:00",
  "dests": [{
    "core_type": "accommodation",
    "ref": "EX-atami-001",
    "slug": "example-villa-atami",
    "verification_status": "verified",
    "core": { "kind": "private_rental", "region_id": "atami", "prefecture": "静岡県", "municipality": "熱海市", "lat": 35.03, "lng": 139.08, "geo_precision": "street", "official_url": "https://example.com/" },
    "texts": [{ "lang": "ja", "name": "例のヴィラ 熱海", "summary": "海を望む一棟貸し", "address": "静岡県熱海市..." }],
    "details": {
      "units": [{ "capacity": 10, "bedrooms": [{ "beds": [{ "bed_type": "double", "count": 2 }] }] }],
      "prices": [{ "amount": 80000, "currency": "JPY", "guests": 10, "tax_included": true }]
    },
    "categories": ["onsen", "bbq"],
    "photos": [{ "file": "images/001.jpg", "license": "none", "source_page_url": "https://example.com/", "subject": "exterior" }],
    "region": { "id": "atami", "name": { "ja": "熱海" }, "parent_id": "izu" },
    "sources": [{ "type": "official", "url": "https://example.com/", "retrieved_at": "2026-11-14", "evidence": "公式の料金表" }]
  }]
}
```
