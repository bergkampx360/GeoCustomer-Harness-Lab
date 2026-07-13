# Data and Seed Requirements

## Seed input

- Source file: `data/seed-customers.json` — 15 customers, each with `name`, `budget`, `location.city`, `location.countryCode`, `note`.
- `location.city` is the customer's settlement (`telepules`).
- The original seed file must not be modified by the implementation.

## Data model (minimum)

`customers` table:

| Field | Notes |
|---|---|
| `id` | — |
| `name` | — |
| `telepules` | the settlement/city |
| `lat` | nullable |
| `lon` | nullable |
| `countryCode` | from seed `location.countryCode`; approved addition — see below |

`budget` and `note` may optionally be stored but are not required.

**`countryCode` decision:** persisted because it is present in the authoritative seed input, supports deterministic offline location resolution, and can participate in reliable idempotent seed identification. This is a data-model decision only — `countryCode` is not exposed in either API response (see `api-contract.md`), since neither frozen source document requires it there.

## Idempotent seed loading

- Loading `seed-customers.json` twice must not duplicate rows: the seed step is idempotent.
- The seed process runs through its own dedicated command, separate from the HTTP API, and must never be exposed as an HTTP endpoint (cross-referenced in `technical-stack.md` and `api-contract.md`).

## Offline geocoding

- Each customer's settlement is resolved to `lat`/`lon` using a local, repo-bundled settlement → lat/lon reference. No external geocoding API or other network call is used.
- The reference is authored by the implementer, covering the settlements that occur in the seed data, using known coordinates.
- Settlement matching must be robust:
  - accent/diacritic-independent;
  - case-independent;
  - whitespace-trimmed.
- "Budapest" — and optionally its districts (`kerület`) — must resolve to the capital.
- If a settlement is not found in the reference:
  - `lat`/`lon` = `null`;
  - this is not an error;
  - the process must not crash;
  - it must be logged;
  - processing continues with the remaining rows.
