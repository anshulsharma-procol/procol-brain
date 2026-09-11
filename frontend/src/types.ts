/**
 * UI-only types. The domain model lives in `platform/types.ts` — this file is
 * for presentational vocabulary that has nothing to do with the product's
 * data, so a screen does not import a colour concept from the domain.
 */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
