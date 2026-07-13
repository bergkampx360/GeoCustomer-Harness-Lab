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

- Customers located in Budapest appear first, each with `distanceKm: 0`.
- Customers with unknown/unresolved coordinates appear at the end of the list, each with `distanceKm: null`.
- Sorting is ascending by `distanceKm`.
- Ties are broken by `name` (ascending).

### Distance calculation

- Computed using the Haversine formula, from each customer's `lat`/`lon` to Budapest's coordinates.
- Unit tests are required for this calculation — see `testing-requirements.md`.

## Fields not included

Neither response includes `countryCode`. It is persisted on the `customers` data model (see `data-and-seed.md`) but is not part of either API contract, since neither frozen source document requires it in a response.

## Separation from seed

The seed/load process is not part of this API surface: it runs as its own dedicated command and is never reachable over HTTP (see `data-and-seed.md`).
