/**
 * Split a script into the sections a human reasons about, so the Interface stage can
 * show the spoken beats beside the interface being built from them.
 *
 * Extracted from the retired `slides.ts` (D31): "slides" was the mental model the scene
 * engine replaced, and this was the only part of that module still doing work.
 */

/**
 * Sections are separated by blank lines. A first line that is SHORT and UPPERCASE is
 * treated as that section's label (a beat name like `HOOK`), which is how the drafts are
 * written; anything else is body.
 */
export function scriptSections(script: string): { label: string; body: string }[] {
  return script
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n');
      const first = lines[0].trim();
      const isLabel =
        lines.length > 1 && first.length <= 40 && first === first.toUpperCase() && /[A-Z]/.test(first);
      return isLabel
        ? { label: first.replace(/:$/, ''), body: lines.slice(1).join('\n').trim() }
        : { label: '', body: block };
    });
}
