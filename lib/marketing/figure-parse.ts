/**
 * Reading April's figure reply.
 *
 * WHY THIS IS NOT JSON. The payload is CSS and HTML, which is inherently multi-line, and JSON
 * requires every newline inside a string to be escaped. Models get that wrong, and the more
 * multi-line the code the more often. Marrs hit it the moment figures grew past a few rules: every
 * build came back "That came back unusable", which was JSON.parse rejecting a literal newline in
 * her CSS. The prompt had asked for the one format least suited to the payload.
 *
 * Delimited blocks cannot fail that way, because between the markers nothing is special. No
 * escaping, no quoting, no single-line requirement.
 *
 * The parsing is deliberately tolerant: models drift on the number of dashes, on case, and on
 * whitespace around a marker. None of that is worth failing a build over.
 */

export type ParsedFigure = {
  name?: string;
  taps?: number;
  interactive?: boolean;
  note?: string;
  css?: string;
  html?: string;
};

/** A single-line field, e.g. `NAME: the lever`. */
function field(text: string, name: string): string | undefined {
  const m = text.match(new RegExp('^' + name + ':[ \\t]*(.*)$', 'im'));
  return m ? m[1].trim() : undefined;
}

/**
 * The text between `---A---` and the next `---B---` (or the end).
 *
 * Matched loosely on purpose: two or more dashes, any case, any surrounding whitespace.
 */
function block(text: string, from: string, until?: string): string | undefined {
  const open = new RegExp('^-{2,}\\s*' + from + '\\s*-{2,}\\s*$', 'im');
  const at = text.search(open);
  if (at === -1) return undefined;
  const nl = text.indexOf('\n', at);
  if (nl === -1) return undefined;
  const rest = text.slice(nl + 1);
  if (!until) return rest.trim();
  const close = new RegExp('^-{2,}\\s*' + until + '\\s*-{2,}\\s*$', 'im');
  const end = rest.search(close);
  return (end === -1 ? rest : rest.slice(0, end)).trim();
}

export function parseFigureBlocks(raw: string): ParsedFigure {
  const text = String(raw ?? '').replace(/\r\n/g, '\n').trim();
  const taps = field(text, 'TAPS');
  const interactive = (field(text, 'INTERACTIVE') ?? '').toLowerCase();
  return {
    name: field(text, 'NAME'),
    note: field(text, 'NOTE'),
    taps: taps === undefined ? undefined : Number(taps.replace(/[^0-9]/g, '')),
    interactive: interactive.startsWith('y') || interactive === 'true',
    css: block(text, 'CSS', 'HTML'),
    html: block(text, 'HTML'),
  };
}

/**
 * Escape the raw control characters that appear INSIDE JSON string values.
 *
 * This is the exact failure that broke Marrs's builds: a model emitting multi-line CSS inside a
 * JSON string without escaping the newlines, which JSON.parse rejects outright. The delimited
 * format above means we no longer ask for JSON at all, but if a future model reaches for it out
 * of habit the same break would return, and losing a whole generation to a newline is not worth
 * it. Walks the text tracking whether it is inside a string, so only the characters that are
 * actually illegal get escaped.
 */
function repairJsonControlChars(text: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString && (ch === '\n' || ch === '\r' || ch === '\t')) {
      out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : '\\t';
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * An older JSON-shaped reply.
 *
 * Kept as a fallback so a response in the previous format still builds, and as the safety net if
 * a future model ignores the markers and reaches for JSON out of habit.
 */
export function parseFigureJson(raw: string): ParsedFigure | null {
  const t = String(raw ?? '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const c = fence ? fence[1] : t;
  const a = c.indexOf('{');
  const b = c.lastIndexOf('}');
  if (a === -1 || b === -1) return null;
  const body = c.slice(a, b + 1);
  // Strict first, then the repaired version: a well-formed reply is never touched.
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(body) as Record<string, unknown>;
  } catch {
    try {
      o = JSON.parse(repairJsonControlChars(body)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  {
    const taps = Number(o.taps);
    return {
      name: typeof o.name === 'string' ? o.name : undefined,
      note: typeof o.note === 'string' ? o.note : undefined,
      taps: Number.isFinite(taps) ? taps : undefined,
      interactive: o.interactive === true,
      css: typeof o.css === 'string' ? o.css : undefined,
      html: typeof o.html === 'string' ? o.html : undefined,
    };
  }
}

/** Blocks first, JSON as the fallback. Whichever yields markup wins. */
export function parseFigureReply(raw: string): ParsedFigure {
  const blocks = parseFigureBlocks(raw);
  if (blocks.html?.trim()) return blocks;
  return parseFigureJson(raw) ?? blocks;
}
