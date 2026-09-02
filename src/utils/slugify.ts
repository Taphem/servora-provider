/**
 * Normalizes a name into a URL-safe slug: lowercase, alphanumeric words
 * joined by single hyphens, no leading/trailing/duplicate hyphens.
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
