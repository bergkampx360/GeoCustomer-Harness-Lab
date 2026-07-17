import { normalizeSettlementName } from './normalize';

export interface Coordinates {
  lat: number;
  lon: number;
}

const BUDAPEST: Coordinates = { lat: 47.4979, lon: 19.0402 };

const ROMAN_NUMERALS_I_TO_XXIII = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
  'XXI', 'XXII', 'XXIII',
];

function budapestDistrictAliases(): [string, Coordinates][] {
  const aliases: [string, Coordinates][] = [];
  for (const numeral of ROMAN_NUMERALS_I_TO_XXIII) {
    aliases.push([normalizeSettlementName(`Budapest ${numeral}`), BUDAPEST]);
    aliases.push([normalizeSettlementName(`${numeral}. kerület`), BUDAPEST]);
  }
  return aliases;
}

/**
 * Bundled offline reference: normalized settlement name -> coordinates.
 * Covers exactly the 15 cities present in data/seed-customers.json, plus
 * Budapest district ("kerület") aliases (AD-6). Coordinates cross-checked
 * against geodatos.net / time-ok.com during Story 1.3 implementation.
 */
export const SETTLEMENT_COORDINATES: ReadonlyMap<string, Coordinates> = new Map([
  ['budapest', BUDAPEST],
  ['vienna', { lat: 48.2082, lon: 16.3738 }],
  ['munich', { lat: 48.1374, lon: 11.5755 }],
  ['milan', { lat: 45.4643, lon: 9.1895 }],
  ['barcelona', { lat: 41.3888, lon: 2.159 }],
  ['lyon', { lat: 45.7491, lon: 4.8479 }],
  ['krakow', { lat: 50.0614, lon: 19.9366 }],
  ['prague', { lat: 50.0755, lon: 14.4378 }],
  ['lisbon', { lat: 38.7223, lon: -9.1393 }],
  ['amsterdam', { lat: 52.3676, lon: 4.9041 }],
  ['stockholm', { lat: 59.3293, lon: 18.0686 }],
  ['ljubljana', { lat: 46.0569, lon: 14.5058 }],
  ['bucharest', { lat: 44.4268, lon: 26.1025 }],
  ['dublin', { lat: 53.3498, lon: -6.2603 }],
  ['copenhagen', { lat: 55.6761, lon: 12.5683 }],
  ...budapestDistrictAliases(),
]);
