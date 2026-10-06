/**
 * src/data/slug.ts
 *
 * Slugify a free-text string into an id-safe token (ascii, kebab-case).
 * Shared by the Player Editor (player id / personId generation) and the
 * spreadsheet importer (champion-name -> id resolution, fallback path).
 *
 * Strips diacritics via NFD normalization, lowercases, collapses any run of
 * non-alphanumeric characters into a single "-", and trims leading/trailing
 * dashes. Example: "Miss Fortune" -> "miss-fortune"; "Lee Sin" -> "lee-sin".
 */
export function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
