import { z } from 'zod'

// OWASP: Input validation — reject unexpected shapes before they reach the DB query.
// Note: in this app user inputs filter an already-fetched in-memory array, not Supabase
// directly. Validation still guards against memory exhaustion, unexpected state, and
// provides a clear contract for what values are considered acceptable.

// Free-text card/set search — allow letters, digits, spaces, and common punctuation
// found in Pokémon card names (hyphens, apostrophes, dots, accented chars via \u00C0-\u017E).
// Max 100 chars prevents runaway includes() comparisons on large arrays.
export const SearchSchema = z.object({
  q: z
    .string()
    .max(100)
    .regex(/^[a-zA-Z0-9\s\u00C0-\u017E\-'\.éèêëàùûüôöîïçæœ]+$/)
    .optional(),
})

// Set IDs are stored as numeric primary keys, passed around as stringified integers.
// Regex ensures only digits — no path traversal or injection characters.
export const SetFilterSchema = z.object({
  setId: z.string().max(10).regex(/^[0-9]+$/).optional(),
})

// Closed enum: only the sort keys that actually have a sorter function in CardGrid.
export const SortSchema = z.enum([
  'price_desc',
  'price_asc',
  'mom_desc',
  'mom_asc',
  'demand',
  'name',
])

// Closed enum: the four signal values written by the model pipeline.
// Empty string represents "no filter" (All Signals).
export const SignalSchema = z.enum([
  '',
  'UNDERVALUED',
  'FAIR VALUE',
  'OVERVALUED',
])

// Closed enum: the three direction states in MoversTab.
export const DirSchema = z.enum(['all', 'up', 'down'])

// Helper: parse and return the safe value, or the fallback on failure.
// Logs the invalid value to the console (server-side / devtools only) without
// surfacing details to the rendered UI.
export function safeValidate<T>(
  schema: z.ZodType<T>,
  value: unknown,
  fallback: T,
): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    console.warn('[validation] rejected input:', value, result.error.flatten())
    return fallback
  }
  return result.data
}
