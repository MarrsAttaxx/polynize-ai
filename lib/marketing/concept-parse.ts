/**
 * Concept-doc parsing helpers, shared by the Output-plan fan-out (video script
 * scaffold) and the text output module (thesis + beats for the post draft).
 *
 * The concept doc is Markdown with a fixed set of section headings (written by
 * April at finalize). We read sections tolerantly: a heading is matched by its
 * text regardless of `#` level or a trailing colon, and bullet/numbered list
 * items under a section are collected as that section's points.
 */

const SECTIONS = new Set([
  'framing',
  'core thesis',
  'who it is for',
  'key beats',
  'proof or story',
  'where it lands',
  'source voice',
]);

function sectionOf(line: string): string | null {
  const t = line.trim().replace(/^#+\s*/, '').replace(/:$/, '').toLowerCase();
  return SECTIONS.has(t) ? t : null;
}

/** Collect the bullet/numbered list items under one named section. */
export function sectionItems(bodyMd: string, section: string): string[] {
  const want = section.toLowerCase();
  const items: string[] = [];
  let inSection = false;
  for (const line of bodyMd.split('\n')) {
    const here = sectionOf(line);
    if (here) {
      inSection = here === want;
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
    const here = sectionOf(line);
    if (here) {
      inSection = here === want;
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
