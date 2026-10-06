/**
 * src/data/errorFormatter.ts
 *
 * Formats ZodError.issues into human-readable "Card X, field Y" messages.
 * This is the SUCCESS CRITERION 2 mechanism — a deliberate error in
 * players.json must degrade to a readable message naming the offending
 * card and field, never exposing a raw ZodError or JS exception.
 *
 * Zod v4 API: iterates `error.issues` directly.
 * Does NOT use the deprecated instance methods `.flatten()` or `.format()`.
 */

import type { ZodError } from "zod";

export type RawPlayerData = {
  players?: Array<{ id?: string }>;
};

/**
 * Converts a ZodError into an array of human-readable strings, one per issue.
 *
 * For issues inside the `players` array the formatter resolves the card's
 * `id` from rawData (e.g. "faker-2016") for a friendly name, falling back
 * to "index N" when the id cannot be read.
 *
 * @param error   - The ZodError returned by safeParse on failure.
 * @param rawData - The raw (unparsed) JSON value for id look-up; optional.
 * @returns       Array of readable strings, one per Zod issue. Never throws.
 *
 * @example
 * // Card "faker-2016", field "lateGame": Number must be less than or equal to 100
 * // Card "faker-2016", field "championPool": Champion pool must have at least 8 champions
 */
export function formatZodErrors(
  error: ZodError,
  rawData?: RawPlayerData
): string[] {
  return error.issues.map((issue) => {
    const path = issue.path;
    const segments: string[] = [];

    if (
      path.length >= 2 &&
      path[0] === "players" &&
      typeof path[1] === "number"
    ) {
      const cardIndex = path[1];
      // Attempt a friendly card name; fall back to "index N"
      const cardId =
        rawData?.players?.[cardIndex]?.id ?? `index ${cardIndex}`;
      segments.push(`Card "${cardId}"`);

      if (path.length > 2) {
        // Remaining path segments after ['players', N, ...] form the field name
        const fieldPath = path.slice(2).join(".");
        segments.push(`field "${fieldPath}"`);
      }
    } else if (path.length > 0) {
      // Non-player-array path: just show the full path as a field reference
      segments.push(`field "${path.join(".")}"`);
    }

    const location = segments.join(", ");
    return location ? `${location}: ${issue.message}` : issue.message;
  });
}
