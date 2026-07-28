/**
 * SLIDES: the operator's plan for the touchscreen, as a short list of cards.
 *
 * This replaces the prose "screen prompt" brief (D29, revised 2026-07-21 after Marrs's
 * first real pass). That brief existed to hand to an external animator, and it carried
 * the BUILD BRIEF / DESIGN SYSTEM / OPERATOR STRIP boilerplate they needed. The console
 * builds the deck itself now, so the engine already knows all of that and printing it
 * only made the panel unreadable: "hide the rest of the system prompt, all I want is
 * slide 1 description, slide 2 description, slide 3 description".
 *
 * So a slide is just the two things a human needs to decide: what is on screen, and
 * what it says. Everything technical (classes, depth, colour roles, gesture
 * choreography, the figure transitions) is the engine's job and stays hidden.
 *
 * Stored as JSON on `piece.slides`.
 */

export type Slide = {
  /** What is on screen: the picture, in plain words. */
  visual: string;
  /** The words on screen, verbatim. Empty for a purely visual slide. */
  text: string;
};

export function parseSlides(raw: string | undefined): Slide[] {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
      .map((s) => ({
        visual: typeof s.visual === 'string' ? s.visual : '',
        text: typeof s.text === 'string' ? s.text : '',
      }))
      .filter((s) => s.visual || s.text);
  } catch {
    return [];
  }
}

export const serializeSlides = (slides: Slide[]): string => JSON.stringify(slides);

/**
 * Split a script into the sections the operator reasons about, so the Screen Prompt
 * stage can show the script beside the slides ("this section needs that slide").
 * Blank lines separate beats, and a bare label line (HOOK, BEAT 1, CLOSE) becomes the
 * section's heading rather than part of its body.
 */
export function scriptSections(script: string): { label: string; body: string }[] {
  return script
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n');
      const first = lines[0].trim();
      const isLabel = lines.length > 1 && first.length <= 40 && first === first.toUpperCase();
      return isLabel
        ? { label: first, body: lines.slice(1).join('\n').trim() }
        : { label: '', body: block };
    });
}
