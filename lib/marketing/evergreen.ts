/**
 * WINNERS REPEAT THEMSELVES (D100, step 7 of the plan in analytics-and-scale.md). The pure half:
 * when an evergreen list should post, how a Metricool list response is read, and how April's copy
 * variants are parsed. The server half that talks to Metricool is autolist.ts.
 */

/**
 * THE QUIET SLOT. The fresh queue owns the network's configured times; evergreen must not compete
 * with them, so it posts six hours after the network's first slot, every day, which lands in the
 * afternoon or evening on every schedule we run. One time, seven days, repeat on. A starting point
 * the operator can move in Metricool's own UI; the console never rewrites a list's timing after
 * making it.
 */
export function evergreenSlotTime(slots: readonly string[]): string {
  const first = [...slots].filter((t) => /^\d{2}:\d{2}$/.test(t)).sort()[0] ?? '09:00';
  const [h, m] = first.split(':').map(Number);
  const hh = (h + 6) % 24;
  return `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Metricool returns lists as an array or one object; find the one we just made (highest id we did not know). */
export function newestListId(json: unknown, known: Set<string>): string | undefined {
  const list = Array.isArray(json) ? json : json && typeof json === 'object' ? [json] : [];
  let best: number | undefined;
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const id = (item as { id?: unknown }).id;
    const n = typeof id === 'number' ? id : typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : undefined;
    if (n === undefined || known.has(String(n))) continue;
    if ((item as { deleted?: unknown }).deleted === true) continue;
    if (best === undefined || n > best) best = n;
  }
  return best === undefined ? undefined : String(best);
}

/** Item ids from a `/lists/posts` style response, optionally only those whose text is one of ours. */
export function itemIds(json: unknown, texts?: readonly string[]): string[] {
  const list = Array.isArray(json) ? json : [];
  const out: string[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const r = item as { id?: unknown; text?: unknown };
    if (r.id === undefined || r.id === null) continue;
    if (texts && !(typeof r.text === 'string' && texts.includes(r.text.trim()))) continue;
    out.push(String(r.id));
  }
  return out;
}

/**
 * April's rewrites. The model is asked for a JSON array of strings; anything else degrades to the
 * original alone rather than failing the promotion, because an evergreen post with one variant is
 * still an evergreen post. Duplicates of the original and blanks are dropped; the original is
 * always first. Capped so a chatty model cannot fill a list.
 */
export function parseVariants(raw: string, original: string, max = 3): string[] {
  const out = [original.trim()];
  let parsed: unknown;
  try {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    parsed = start >= 0 && end > start ? JSON.parse(raw.slice(start, end + 1)) : undefined;
  } catch {
    parsed = undefined;
  }
  if (Array.isArray(parsed)) {
    for (const v of parsed) {
      if (typeof v !== 'string') continue;
      const t = v.trim();
      if (!t || out.includes(t)) continue;
      out.push(t);
      if (out.length >= max) break;
    }
  }
  return out;
}
