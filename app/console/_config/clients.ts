/**
 * Engagement slugs are DISCOVERED dynamically (see
 * `lib/github-client.ts#listAccessibleRepoSlugs` + `_lib/load-clients.ts`),
 * not hardcoded — a freshly-seeded repo appears with no code change.
 *
 * CONSOLE_CLIENTS remains as a resilience FALLBACK: if dynamic discovery
 * fails (GitHub outage, auth blip) the dashboard still shows the known
 * engagements instead of going blank. It is no longer the source of truth.
 */
export const CONSOLE_CLIENTS = ['everstock'] as const;

export type ClientSlug = (typeof CONSOLE_CLIENTS)[number];

/**
 * Format guard for a console engagement slug. The route handlers use this in
 * place of a membership check against a fixed list, so any real engagement
 * slug resolves. Existence is enforced downstream by the file read (a
 * non-existent repo 404s). Rejects path-traversal / malformed input:
 * lowercase alphanumeric + hyphens, must start alphanumeric.
 */
export function isValidConsoleSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,99}$/.test(slug);
}
