/**
 * Light access guard for the /content/<show>/<episode> shoot sheets.
 *
 * v1 has no real auth (it is a single-user studio tool). To keep it from being
 * publicly writable, every request (page GET + state GET/PUT) must carry a
 * shared token. The token is read from `CONTENT_SHEET_TOKEN` in the env; if that
 * is unset it falls back to a baked unguessable default so the tool works
 * immediately and the path is never openly writable. Set the env var in
 * production to rotate it.
 *
 * The token rides in the URL as `?k=<token>` (so a bookmarked iPad URL just
 * works) and/or the `x-sheet-token` header (used by the autosave fetches).
 */

const DEFAULT_TOKEN = '7b9e2f4a6c1d8035e94a7c2b5f0d6e13';

export function sheetToken(): string {
  return process.env.CONTENT_SHEET_TOKEN || DEFAULT_TOKEN;
}

/** Constant-ish equality check on the provided token. */
export function tokenOk(provided: string | null | undefined): boolean {
  return !!provided && provided === sheetToken();
}

/** Pull the token from either the `x-sheet-token` header or the `k` query param. */
export function tokenFromRequest(req: Request): string | null {
  const header = req.headers.get('x-sheet-token');
  if (header) return header;
  try {
    return new URL(req.url).searchParams.get('k');
  } catch {
    return null;
  }
}
