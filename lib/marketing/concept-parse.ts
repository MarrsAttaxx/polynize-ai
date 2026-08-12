/**
 * Concept-doc parsing helpers, shared by the Output-plan fan-out (video script
 * scaffold) and the text output module (thesis + beats for the post draft).
 *
 * The concept doc is Markdown with a fixed set of section headings. April writes
 * the canonical set; IMPORTED concepts (e.g. extracted from meetings, D25) use
 * near-miss headings ("Who it's for", "The core concept"), so matching is
 * tolerant: `#` level, trailing colons, and contractions are normalized, close
 * synonyms are aliased, and any UNRECOGNIZED heading still ends the current
 * section (so an imported doc's extra sections never bleed into a known one).
 */

const SECTIONS = new Set([
  'framing',
  'core thesis',
  'who it is for',
  // The hook-ammunition sections, added 2026-08-12. The concept used to capture the
  // ARGUMENT (thesis, beats, where it lands) and almost none of the raw material a hook is
  // built from, which is why scripts drafted from a thin concept came out generic: the
  // script prompt forbids inventing specifics, so with nothing concrete in the concept a
  // vague hook was the correct output.
  'what they believe instead',
  'key beats',
  'concrete specifics',
  'what it costs them',
  'proof or story',
  'where it lands',
  'lines worth keeping',
  'source voice',
]);

/** Close synonyms seen in imported docs, mapped onto the canonical names. */
const ALIASES: Record<string, string> = {
  'core concept': 'core thesis',
  'the core concept': 'core thesis',
  'core value of the idea': 'where it lands',
};

function isHeading(line: string): boolean {
  return /^\s*#{1,6}\s/.test(line);
}

function sectionOf(line: string): string | null {
  let t = line
    .trim()
    .replace(/^#+\s*/, '')
    .replace(/:$/, '')
    .toLowerCase()
    // "Who it's for" (imported) vs "Who it is for" (April): drop contractions.
    .replace(/[’']/g, '')
    .replace(/\bwho its for\b/, 'who it is for')
    .trim();
  t = ALIASES[t] ?? t;
  return SECTIONS.has(t) ? t : null;
}

/** Collect the bullet/numbered list items under one named section. */
export function sectionItems(bodyMd: string, section: string): string[] {
  const want = section.toLowerCase();
  const items: string[] = [];
  let inSection = false;
  for (const line of bodyMd.split('\n')) {
    if (isHeading(line)) {
      inSection = sectionOf(line) === want;
      continue;
    }
    // Non-heading section labels (e.g. "Key beats:" on its own line) also count.
    const bare = sectionOf(line);
    if (bare !== null) {
      inSection = bare === want;
      continue;
    }
    if (!inSection) continue;
    const m = line.match(/^\s*(?:[-*]|\d+[.)])\s+(.*\S)/);
    if (m) items.push(m[1].trim());
  }
  return items;
}

/** The prose (non-list) text under one named section, joined into a paragraph. */
export function sectionProse(bodyMd: string, section: string): string {
  const want = section.toLowerCase();
  const lines: string[] = [];
  let inSection = false;
  for (const line of bodyMd.split('\n')) {
    if (isHeading(line)) {
      inSection = sectionOf(line) === want;
      continue;
    }
    const bare = sectionOf(line);
    if (bare !== null) {
      inSection = bare === want;
      continue;
    }
    if (!inSection) continue;
    const t = line.trim();
    if (!t) continue;
    if (/^(?:[-*]|\d+[.)])\s+/.test(t)) continue; // list items handled by sectionItems
    lines.push(t);
  }
  return lines.join(' ').trim();
}

/** Build a starting video script from the concept: HOOK + the key beats + CTA. */
export function scaffoldScript(framing: string, bodyMd: string): string {
  const beats = sectionItems(bodyMd, 'key beats');
  const parts: string[] = ['HOOK', framing.trim(), ''];
  beats.forEach((b, i) => parts.push(`BEAT ${i + 1}`, b, ''));
  parts.push('CTA', '');
  return parts.join('\n').trimEnd() + '\n';
}
