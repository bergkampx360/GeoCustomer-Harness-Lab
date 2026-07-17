/**
 * Normalizes a settlement name for lookup matching: strips accents (via
 * Unicode NFD decomposition + combining-mark removal), lowercases, and trims
 * surrounding/repeated whitespace. Pure function — no I/O.
 */
export function normalizeSettlementName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
