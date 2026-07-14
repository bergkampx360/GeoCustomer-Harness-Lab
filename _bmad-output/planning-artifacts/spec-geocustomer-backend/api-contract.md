# API Contract

Exactly two endpoints are exposed. No `POST`, `PUT`, `PATCH`, or `DELETE` endpoints of any kind, and no endpoint beyond these two.

## `GET /customers/count`

Response:

```json
{
  "count": 15
}
```

`count` must equal the actual row count in the `customers` table.

## `GET /customers/by-distance`

Returns the customer list ordered by ascending distance from Budapest.

Each item includes a `distanceKm` field, rounded to one decimal place.

### Distance and sorting rules

- **Sorting is ascending by the raw, unrounded Haversine distance — not by the rounded `distanceKm` value.** `distanceKm` is a display-only rounding of that same raw distance, to one decimal place; it is never itself the sort key.
- Customers located in Budapest appear first, each with a raw distance of `0` and `distanceKm: 0`.
- Customers with unknown/unresolved coordinates appear after every customer with a calculable distance, each with `distanceKm: null`.
- Ties are broken by `name` (ascending), applied only when two customers' **raw** distances are exactly equal — not merely when their rounded `distanceKm` values coincide.

### Distance calculation

- Computed using the Haversine formula, from each customer's `lat`/`lon` to Budapest's coordinates.
- The raw Haversine result is the sort key; `distanceKm` (rounded to one decimal) is derived from it only when producing the response body, after sorting.
- Unit tests are required for this calculation — see `testing-requirements.md`.

## Fields not included

Neither response includes `countryCode`. It is persisted on the `customers` data model (see `data-and-seed.md`) but is not part of either API contract, since neither frozen source document requires it in a response.

## Separation from seed

The seed/load process is not part of this API surface: it runs as its own dedicated command and is never reachable over HTTP (see `data-and-seed.md`).
