import { normalizeTownName } from './normalize-town.js';

export interface Coordinates {
  lat: number;
  lon: number;
}

/**
 * Local, bundled reference of known city-center coordinates for exactly the
 * 15 cities present in data/seed-customers.json. No external geocoding call
 * is made anywhere in this project; this table is the entire "geocoder".
 */
const CITY_COORDINATES: Record<string, Coordinates> = {
  Budapest: { lat: 47.4979, lon: 19.0402 },
  Vienna: { lat: 48.2082, lon: 16.3738 },
  Munich: { lat: 48.1351, lon: 11.582 },
  Milan: { lat: 45.4642, lon: 9.19 },
  Barcelona: { lat: 41.3874, lon: 2.1686 },
  Lyon: { lat: 45.764, lon: 4.8357 },
  Kraków: { lat: 50.0647, lon: 19.945 },
  Prague: { lat: 50.0755, lon: 14.4378 },
  Lisbon: { lat: 38.7223, lon: -9.1393 },
  Amsterdam: { lat: 52.3676, lon: 4.9041 },
  Stockholm: { lat: 59.3293, lon: 18.0686 },
  Ljubljana: { lat: 46.0569, lon: 14.5058 },
  Bucharest: { lat: 44.4268, lon: 26.1025 },
  Dublin: { lat: 53.3498, lon: -6.2603 },
  Copenhagen: { lat: 55.6761, lon: 12.5683 },
};

export const BUDAPEST_COORDINATES: Coordinates = CITY_COORDINATES['Budapest'];

export const TOWN_REFERENCE: ReadonlyMap<string, Coordinates> = new Map(
  Object.entries(CITY_COORDINATES).map(([town, coordinates]) => [
    normalizeTownName(town),
    coordinates,
  ]),
);
