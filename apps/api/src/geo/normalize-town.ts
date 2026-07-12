const UNICODE_COMBINING_MARKS = /\p{M}/gu;

/**
 * Normalizes a town name for matching: trims whitespace, strips diacritics
 * (via Unicode NFD decomposition), and lowercases. Applied identically to
 * both the bundled reference keys and incoming seed data so matching stays
 * consistent regardless of accents, case, or surrounding whitespace.
 */
export function normalizeTownName(input: string): string {
  return input
    .trim()
    .normalize('NFD')
    .replace(UNICODE_COMBINING_MARKS, '')
    .toLowerCase();
}
