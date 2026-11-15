Purpose: how an agent uploads data to WANDRARA — how to run the script, and which resources go where in which schema.

# WANDRARA Data Upload Guide for Agents

To add data to WANDRARA, prepare a bundle (JSON) and its photos, then run `pnpm import:bundle`. Uploaded data is saved as a draft. You publish it yourself with `pnpm dest:publish` (see "Publishing").

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
pnpm import:bundle <bundle.json> --parallel  # same, but 6 photos / dests at a time (--parallel=N for 1–16)
```

Use `--parallel` for bundles with many photos. With it, the result lines come out in the order each dest finishes, not in bundle order.

Each dest is sent on its own, so read the result per `ref`:

| Case | What you see | What to do next |
| --- | --- | --- |
| New registration | `draft: <ref> → /d/<slug>` for a ref never sent before | Publish it yourself with `pnpm dest:publish <ref>`; it then appears at https://wandrara.vercel.app/d/<slug> |
| Unchanged | `unchanged: <ref> → /d/<slug>（<status> のまま）` | The content is the same as the last upload, so nothing was written. A published dest stays published |
| Full replace | `draft: <ref> → /d/<slug>` for a ref you sent before | The content changed, so the dest now holds exactly what you sent this time (see "Updates replace everything" below). A published dest is back in draft |
| Partial success | Some `draft:` / `unchanged:` lines and some `error:` lines; exit code 1 | Fix the refs that printed `error:` and run the same bundle again. Dests whose content did not change print `unchanged:` and are not touched |
| Not registered | `error: <ref>: <reason>` where the reason is a photo error or an API answer (400 invalid data, 401 bad key, 403 not allowed, 409 ref conflict) | Nothing was saved for that ref. Fix the cause and send it again |
| Result unknown | `error: <ref>: <reason>` where the reason is a network error, a timeout or HTTP 5xx | The dest may or may not have been saved. Ask the WANDRARA team to check that ref. If you resend, use the same ref and the complete data |

`dry-run: dest N 件 / 写真 N 枚を確認した` means the shape and photos are fine and nothing has been sent. `bundle が正しくない:` followed by a list means the bundle has shape errors and nothing has been sent; fix each path in the list (e.g. `/dests/0/core/kind`).

### Publishing

```sh
pnpm dest:publish <ref>...             # publish
pnpm dest:publish <ref>... --draft     # take it back to draft
```

- You can change only refs you registered yourself. Others print `error: <ref>: 別の登録者のもの`.
- After publishing, it can take up to about a minute before the page shows on the site.
- Exit code 1 if any ref failed; the other refs are still processed.

### Updates replace everything

If the content is exactly the same as the last upload of that `ref`, nothing is written (`unchanged:`). The dest-level `sources` and `verification_status` are not compared, so a new `retrieved_at` there alone does not count as a change. For accommodations, `details.sources` is part of `details`, so a new `retrieved_at` in it does count as a change.

There is no partial update. Sending a `ref` that already exists with changed content deletes everything stored for that dest — core columns, details, texts, photos and categories — and stores only what you sent. Anything you leave out is not kept. For example, resending a dest with only new prices removes its photos and amenities.

Always resend one dest with its complete data.

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
| `ref` | yes | `<prefix>-<id>` (letters, digits, `_`, `-`; up to 80 chars). Unique across all agents and core types. See "Choosing ref" |
| `slug` | no | The URL name (lowercase letters, digits, hyphens; 3–60 chars). Derived from ref if omitted. Never changes for an existing dest |
| `core` | yes | Columns of the core table (kind, location, official URL, ...) |
| `texts` | yes | Per language: `lang`, `name` (required), `summary`, `address` |
| `details` | no | Accommodation: one JSON object (see "Accommodation details"). Other core types: arrays per detail key (next section) |
| `categories` | no | Array of category ids. Unknown ids are created |
| `photos` | no | Photos (see "Photo upload") |
| `region` | no | `{id, name, parent_id}`. Created when `core.region_id` is not in the DB yet |
| `sources` | no | Array of sources (`type`, `url`, `retrieved_at`, `evidence`). Not stored as columns; kept in the raw import record. For accommodations, write sources in `details.sources` instead |
| `verification_status` | no | verified / unverified / conflict. Kept in the raw import record |

### Choosing ref

A `ref` identifies one dest across all of WANDRARA, not only within your agent. The API checks it like this:

- A new ref creates a new dest.
- A ref you registered before replaces that dest (see "Updates replace everything").
- A ref registered by someone else, or registered with a different `core_type`, is refused with 409 and nothing changes.

Rules:

1. Use the prefix the WANDRARA team assigns to your agent (e.g. `WR`), followed by an ID that is unique within your data: `WR-atami-008`.
2. Keep the same ref for the same place every time you collect it again.
3. Use each ref at most once per bundle. A bundle with a repeated ref is rejected before anything is sent (`bundle が正しくない: /dests/N/ref ...`).
4. To take over a dest someone else registered (for example, after a re-collection by a different agent), ask the WANDRARA team. They check the existing ref and reassign it to you. Do not create a second ref for the same place.

Do not write `dest_id`, `id`, `sort` or `operator_id` (`sort` follows array order). Columns that point from a nested child to its parent, or from one detail to another, are not accepted. In accommodations, references use keys inside the dest (see "Keys and references").

## core and details per core type

Each `core_type` has its own `core` columns and `details`. Accommodation `details` is one JSON object (next section). The other 5 core types use arrays per detail key, as in the table. Core types with a location can also take `region_id`, `prefecture`, `municipality`, `district`, `lat`, `lng` and `geo_precision` (exact / street / district / municipality) in `core`.

| core_type | kind values | Main core columns | details keys (main columns) |
| --- | --- | --- | --- |
| accommodation | hotel, ryokan, private_rental, minshuku, pension, glamping, campsite | kind, check_in, check_out, official_url | one JSON object (see "Accommodation details") |
| experience | tour, workshop, tasting, activity, facility_use, event | kind, region_id, duration_minutes, reservation_required, official_url | courses / prices(unit, audience, amount, currency) / schedules / locations / inclusions / cautions / booking_links |
| nature | coast, mountain, lake, highland, gorge, waterfall, forest, volcano | kind, protection | seasons / hours_fees / access / trails(name, distance_km, difficulty) / restrictions / cautions |
| village | onsen_town, post_town, fishing_village, temple_town, castle_town | kind, region_id, municipality | walks / shop_hours / access / events / cautions |
| building | museum, shrine, temple, castle, observatory, historic_building | kind, official_url | hours / fees(label, amount, currency) / access / events / cautions |
| hotspring | day_use, public_bath, foot_bath | kind, official_url | baths(bath_type, spring_handling, spring_quality) / hours / fees(fee_kind, amount, currency) / amenities / access / cautions |

For the 5 table-shaped core types, write nested children inside the parent row as an array under the child's key. Free text (cautions, notes) is `{"ja": "...", "en": "..."}`, times are `HH:MM`, dates are `YYYY-MM-DD`, and amounts are numbers.

## Accommodation details

For `core_type: "accommodation"`, `details` is one JSON object. Every field may be left out (left out = unknown). Unknown keys are rejected. The old table shape (`units`, `parkings`, `prices` as an array, `bed_type`, ...) is rejected.

| Field | Content |
| --- | --- |
| `rooms` | Array of rooms: `key` (required), `name`, `capacity` (max guests), `area_sqm`, `tatami`, `style`, `view`, `smoking`, `bedrooms[].beds[]` (`type`, `count`) |
| `baths` | Array of baths: `kind` (required; saunas are `sauna`), `sauna_style` (only when kind is `sauna`), `hot_spring`, `spring`, `source`, `gender`, `open_from`, `open_to`, `reservation`, `fee`, ... |
| `meals` | Array of meals: `meal` (breakfast / dinner), `offered` (required), `style`, `place`, `served_from`, `served_to`, `fee`, ... |
| `prices` | `{ seasons, items }`: price periods and prices (see "Prices") |
| `amenities` | Array: `code` (from the vocabulary), `options`, `count`, `paid`, `note` |
| `internet` / `pets` / `rules` / `parking` / `access` / `surroundings` | One object each |
| `cautions` | Array of `{ "note": { "ja": "..." } }` |
| `licenses` | Array: `kind` (ryokan_business / minpaku / special_zone_minpaku / simple_lodging), `number` |
| `booking_links` | Array: `label`, `url`, `is_official` |
| `sources` | Array: `name`, `url`, `type` (official / ota / map / other), `retrieved_at` (YYYY-MM-DD), `fields` (which fields came from this source, e.g. `["prices", "rooms"]`) |

Codes (bath kinds, amenity codes, bed types, ...) come from [`src/lib/vocab/accommodation.ts`](../src/lib/vocab/accommodation.ts). The source of truth for the shape is `src/lib/accommodation/details.ts` and `prices.ts`. Money is `{ "amount": number >= 0, "currency": "JPY", "tax_included": true }`.

### Keys and references

- Name each room with `rooms[].key`: lowercase letters, digits, `_`, `-`; 1–40 chars; unique within the dest. A whole-house rental has one room (e.g. `house`).
- Name each price period with `prices.seasons[].key` (same rule).
- A price points to a room with `prices.items[].room` and to a period with `prices.items[].season`. A key that does not exist is rejected. A price without `season` applies to every day.
- A room photo points to a room with `photos[].room`. A key not in `rooms` is rejected.
- No ids. References always use keys inside the dest.

### Prices

- Each `items[]` entry needs `kind` (room / meal / service_fee / bath_tax / lodging_tax / cleaning), `per` (house_night / room_night / person_night / stay) and `currency`. Write exactly one of `amount` and `rate_percent`.
- Write service fees, bath tax and cleaning fees as their own items with their own `kind`, not as caution text. If the room price already includes one, list it in that price's `includes`.
- Child prices use `audience: "child"` with `age_min` / `age_max`. If the child price is a share of the adult price, use `rate_percent`.
- Prices that depend on the number of guests use `guests_min` / `guests_max`. A price range uses `amount` and `amount_max`. Meals use `meals` (none / breakfast / dinner / both).
- Each `seasons[]` entry needs `valid_from` and `valid_to`. The period for days no other period matches has `is_default: true`. Weekends and peak periods use `weekdays` (1 = Mon … 7 = Sun), `dates`, `holidays`, `day_before_holiday` and `priority` (higher wins).

## Required fields (v1)

Every dest must meet these before it is sent. The check runs in `pnpm import:bundle` (including `--dry-run`) and again in the API. If any dest fails, the whole bundle is rejected with `bundle が正しくない:` and one line per missing field (e.g. `/dests/3/details/prices/items 宿泊料（kind: room・amount > 0・currency）が 1 つ以上要る`). Nothing is sent. Text may be in any language.

| core_type | Required |
| --- | --- |
| all | a text with `name` and `summary`; at least 1 photo; `core.region_id`; a source (`core.official_url` or `sources[].url`) |
| accommodation | `texts[].address`; `lat`/`lng` inside Hakone and Izu; `check_in` and `check_out`; at least 1 `details.rooms` entry with `capacity` > 0; at least 1 `details.prices.items` entry with `kind: "room"`, `amount` > 0 and `currency`; every `photos[].room` is a key in `details.rooms`. The source may also be a `details.sources[].url` |
| experience | at least 1 `prices` with `amount` > 0 and `currency`; `duration_minutes`; `core.official_url` or a `booking_links` URL; at least 1 `locations` with `lat`/`lng` inside Hakone and Izu |
| building | `texts[].address`; `lat`/`lng` inside Hakone and Izu; at least 1 `hours`; at least 1 `fees` with `amount` (free entry is `0`) |
| hotspring | `texts[].address`; `lat`/`lng` inside Hakone and Izu; at least 1 `hours`; a `fees` row with `fee_kind: "adult"` and `amount`; at least 1 `baths` with `spring_quality` |
| nature | `lat`/`lng` inside Hakone and Izu; at least 1 `access` |
| village | `lat`/`lng` inside Hakone and Izu; at least 1 `access` |

"Inside Hakone and Izu" means latitude 34.55–35.35 and longitude 138.65–139.25.

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
| `room` | no | Accommodation only: the `details.rooms[].key` this photo shows (use with `subject: "room"`) |

Accepted formats are jpeg, png, webp and avif, up to 10 MB each. The format is detected from the file contents, not the extension. Images that are only placed in `images/` are not used — list every image you want in `photos`.

If any photo of a dest cannot be read or uploaded, that dest is not registered and an `error:` line is printed. Other dests continue.

Uploaded photos are public even while the dest is a draft: they are stored in a public bucket, and anyone with the URL can fetch them. Photos with `license: "none"` (rights not confirmed) are currently accepted and stored the same way, so they are reachable by URL even before you publish the dest.

## Example (one stay)

A made-up stay. With `data/atami-01/bundle.json`, `data/atami-01/images/001.jpg` and `002.jpg` in place. The smallest valid example is [`scripts/import-bundle/fixtures/bundle.json`](../scripts/import-bundle/fixtures/bundle.json).

```json
{
  "bundle_version": "2",
  "collector": "hotel-collector",
  "collected_at": "2026-11-15T10:00:00+09:00",
  "dests": [{
    "core_type": "accommodation",
    "ref": "EX-atami-001",
    "slug": "example-ryokan-atami",
    "verification_status": "verified",
    "core": { "kind": "ryokan", "region_id": "atami", "prefecture": "静岡県", "municipality": "熱海市", "lat": 35.1, "lng": 139.07, "geo_precision": "street", "check_in": "15:00", "check_out": "10:00", "official_url": "https://example.com/" },
    "texts": [{ "lang": "ja", "name": "例の宿 熱海", "summary": "温泉の大浴場がある旅館", "address": "静岡県熱海市..." }],
    "details": {
      "rooms": [{ "key": "washitsu", "name": { "ja": "和室" }, "capacity": 2, "tatami": 8, "style": "japanese", "bedrooms": [{ "beds": [{ "type": "futon", "count": 2 }] }] }],
      "baths": [{ "kind": "public", "hot_spring": true, "gender": "separate" }],
      "prices": {
        "seasons": [
          { "key": "regular", "valid_from": "2026-04-01", "valid_to": "2027-03-31", "is_default": true },
          { "key": "saturday", "valid_from": "2026-04-01", "valid_to": "2027-03-31", "weekdays": [6], "priority": 1 }
        ],
        "items": [
          { "kind": "room", "per": "person_night", "room": "washitsu", "season": "regular", "amount": 20000, "currency": "JPY", "tax_included": true, "meals": "both", "audience": "adult", "includes": ["service_fee"] },
          { "kind": "room", "per": "person_night", "room": "washitsu", "season": "saturday", "amount": 24000, "currency": "JPY", "tax_included": true, "meals": "both", "audience": "adult", "includes": ["service_fee"] },
          { "kind": "room", "per": "person_night", "room": "washitsu", "audience": "child", "age_min": 6, "age_max": 11, "rate_percent": 70, "currency": "JPY", "meals": "both" },
          { "kind": "bath_tax", "per": "person_night", "amount": 150, "currency": "JPY", "audience": "adult" }
        ]
      },
      "amenities": [{ "code": "wifi" }, { "code": "hair_dryer" }],
      "sources": [{ "name": "公式サイト", "url": "https://example.com/", "type": "official", "retrieved_at": "2026-11-14", "fields": ["rooms", "prices"] }]
    },
    "categories": ["onsen"],
    "photos": [
      { "file": "images/001.jpg", "license": "none", "source_page_url": "https://example.com/", "subject": "exterior" },
      { "file": "images/002.jpg", "license": "none", "source_page_url": "https://example.com/", "subject": "room", "room": "washitsu" }
    ],
    "region": { "id": "atami", "name": { "ja": "熱海" } }
  }]
}
```
