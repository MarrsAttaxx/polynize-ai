/**
 * WHERE THE POST FOLDS, which is the only thing a preview knows that the editor does not.
 *
 * Marrs: "What I would like here is a preview of what it would look like on the actual platform.
 * I know that Metricool offers this in the platform... as an individual, I'd want to see how
 * that's going to look on the actual platform."
 *
 * THIS IS NOT DECORATION. A preview that only restates the words is a second textarea. The one
 * fact it carries that nothing else on the screen does is whether the hook survives the "see
 * more" fold, because everything after the fold is read by the people who already decided to
 * read on. Getting that line in the right place is the whole point of the panel.
 *
 * EVERY NUMBER HERE IS SOURCED, and the sources are in docs/pam-console/output-spec.md rather
 * than in someone's memory. Two of the three are third-party consensus with no official figure,
 * which is why they are described as approximate on screen. The one platform where the spec says
 * NO DATA gets no fold line at all: an invented one would be worse than none, because he would
 * write to it.
 *
 * CLIENT SAFE and pure: no imports, because the preview is a 'use client' island and one store
 * import puts node:crypto in the browser bundle (D47).
 */

export type PreviewNetwork = 'linkedin' | 'instagram';

export type FoldRule = {
  /** Characters visible before the fold. */
  chars: number;
  /**
   * Paragraphs visible before the fold, when a platform folds on structure as well as length.
   *
   * MEASURED AGAINST METRICOOL'S OWN PREVIEW (D77), which is a better source than the third-party
   * consensus this started from. Marrs published a real post whose first paragraph is 68 characters
   * and Metricool's LinkedIn preview cut it right there, at the paragraph break, nowhere near 140.
   *
   * So the structure wins over the count for anything written in the house style, and one paragraph
   * is what the fold shows. A post written as one long block still gets the character cap.
   */
  paragraphs?: number;
  /** What the platform's own control says. */
  moreLabel: string;
  /** Said on screen, because these are observed and consensus figures rather than published ones. */
  note: string;
};

/**
 * LinkedIn folds after the FIRST PARAGRAPH or about 140 characters, whichever comes first, and it
 * COLLAPSES: everything after is hidden behind the control, not dimmed, which is why the image sits
 * directly under two lines of text rather than under the whole post.
 *
 * Instagram truncates at about 125 characters. Meta publishes no figure for the feed, but their own
 * ads guide recommends 125 characters of primary text, which matches the third-party number.
 */
const FOLDS: Record<PreviewNetwork, FoldRule> = {
  linkedin: {
    chars: 140,
    paragraphs: 1,
    moreLabel: '…see more',
    note: 'Where LinkedIn folds: the first paragraph, or about 140 characters. Everything after it is hidden until someone taps.',
  },
  instagram: {
    chars: 125,
    moreLabel: '… more',
    note: 'Roughly where Instagram truncates a caption.',
  },
};

/** No entry means no preview chrome for that network yet, which is said rather than faked. */
export function foldRule(network: string): FoldRule | undefined {
  return FOLDS[network as PreviewNetwork];
}

export function isPreviewNetwork(network: string): network is PreviewNetwork {
  return network === 'linkedin' || network === 'instagram';
}

export type Folded = {
  /** What is read before anyone taps anything. */
  head: string;
  /** What is behind the fold. Empty when the whole post is visible. */
  tail: string;
  /** Which limit closed it, so the panel can say why. */
  reason: 'chars' | 'paragraph' | null;
};

/**
 * Split copy at the fold.
 *
 * Whichever limit bites first wins, because the platform applies both. The character cut backs up
 * to the last space so the preview breaks between words the way the platform does, rather than
 * mid-word, which would misrepresent how much text is actually visible.
 */
export function foldCopy(text: string, rule: FoldRule | undefined): Folded {
  if (!rule) return { head: text, tail: '', reason: null };

  let cut = text.length;
  let reason: Folded['reason'] = null;

  if (rule.paragraphs) {
    /**
     * A PARAGRAPH BREAK IS A BLANK LINE, which is how everything in this console is written and how
     * the platforms read it. Counting single newlines instead would cut a two-line address block in
     * half and report it as the fold.
     */
    const rx = /\n[ \t]*\n/g;
    let seen = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      seen += 1;
      if (seen === rule.paragraphs) {
        cut = m.index;
        reason = 'paragraph';
        break;
      }
    }
  }

  if (text.length > rule.chars && rule.chars < cut) {
    // Back up to a word boundary, but never so far that the head becomes useless.
    const slice = text.slice(0, rule.chars);
    const space = slice.lastIndexOf(' ');
    cut = space > rule.chars * 0.6 ? space : rule.chars;
    reason = 'chars';
  }

  if (cut >= text.length) return { head: text, tail: '', reason: null };
  return { head: text.slice(0, cut), tail: text.slice(cut), reason };
}

/**
 * Characters, the unit every platform limit in output-spec.md is written in.
 *
 * Counted off the string rather than off a word count because that is what the platforms count,
 * and because a 3,000 character LinkedIn limit rejected at 3,001 is not a rounding question.
 */
export function copyLength(text: string): number {
  return text.length;
}
