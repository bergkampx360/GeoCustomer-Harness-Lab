# GeoCustomer Harness Lab – feladatspecifikáció

> Forrás: `docs/hw5-1.pdf`, C) Részletes prompt  
> Ezt a specifikációt változtatás nélkül kell megkapnia mindkét harnessnek.

## Részletes prompt

Építs egy kicsi, önálló REST szolgáltatást Postgres fölött. Offline kell futnia: nincs külső geokódoló API, nincs LLM-hívás futásidőben.

## ADAT

A seed adat a repóban lévő `seed-customers.json` fájlban van (15 ügyfél: `name`, `budget`, `location.city`, `location.countryCode`, `note`). A `location.city` a település.

## ADATMODELL (minimum)

`customers`: `id`, `name`, `telepules`, `lat` (nullable), `lon` (nullable).

A `budget` és a `note` eltárolható, de nem kötelező.

## BETÖLTÉS (idempotens seed + geokódolás)

- Töltsd be a `seed-customers.json`-t. Kétszer lefuttatva ne duplázzon, idempotens legyen.
- Minden ügyfél településéhez rendelj `lat`/`lon` értéket egy lokális, a repóba bundle-olt `telepules -> lat/lon` referenciából.
- A referenciát te állítod elő a seedben előforduló városokra, ismert koordinátákkal.
- NINCS külső hívás.
- A település-egyeztetés robusztus:
  - ékezetfüggetlen;
  - kis- és nagybetű-független;
  - trimmelt whitespace.
- A „Budapest” — és opcionálisan a kerületei — a fővárosra esik.
- Ha egy település nincs a referenciában:
  - `lat`/`lon = null`;
  - ez nem hiba;
  - ne crasheljen;
  - logold;
  - menj tovább.

## VÉGPONTOK

### `GET /customers/count`

Válasz:

```json
{
  "count": 15
}
```

A tényleges sorszámmal egyezik.

### `GET /customers/by-distance`

Ügyféllista NÖVEKVŐ távolság szerint Budapesthez képest.

Minden elem tartalmazza a `distanceKm` mezőt, egy tizedesre kerekítve.

Szabályok:

- a budapesti ügyfelek elöl szerepelnek, `0 km` távolsággal;
- az ismeretlen koordinátájú ügyfelek a lista végén szerepelnek;
- az ismeretlen koordinátájú ügyfelek esetén `distanceKm: null`;
- holtverseny esetén rendezés `name` szerint.

## TESZT

Unit teszt a távolságszámításra, Haversine-formulával:

- egy ismert táv, például Budapest–Bécs körülbelül 214 km;
- a 0 km-es eset, Budapest;
- a null-koordináta kezelése.

## MINŐSÉG

- Kis, fókuszált commitok, hogy a folyamat is látszódjon.
- README a futtatáshoz:
  - Postgres indítás;
  - migráció;
  - seed;
  - szerver;
  - tesztek.
- Kösd be a Postgres MCP-t, hogy fejlesztés közben lásd a sémát és az adatot.