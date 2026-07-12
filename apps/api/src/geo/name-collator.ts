/**
 * Shared, explicitly-configured collator for deterministic name tie-breaking.
 * A fixed locale/sensitivity avoids depending on the host's default locale.
 */
export const nameCollator = new Intl.Collator('en', { sensitivity: 'base' });
