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
   * Lines visible before the fold, when a platform folds on line count as well.
   *
   * This matters more than the character count for anything written in the LinkedIn house style:
   * output-spec.md records that "line breaks count, so many short lines truncate even earlier".
   * A post of five three-word lines is 60 characters and still folded.
   */
  lines?: number;
  /** What the platform's own control says. */
  moreLabel: string;
  /** Said on screen, because these are consensus figures and not published ones. */
  note: string;
};

/**
 * LinkedIn folds at roughly 140 characters on mobile and roughly 210 on desktop. The stricter
 * one is previewed: a hook that survives the mobile fold survives both, and the reverse is not
 * true. Three lines is the shape the same source describes.
 *
 * Instagram truncates at about 125 characters. Meta publishes no figure for the feed, but their
 * own ads guide recommends 125 characters of primary text, which matches the third-party number.
 */
const FOLDS: Record<PreviewNetwork, FoldRule> = {
  linkedin: {
    chars: 140,
    lines: 3,
    moreLabel: '…see more',
    note: 'Roughly where LinkedIn folds on a phone. Desktop shows about 210 characters.',
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
  reason: 'chars' | 'lines' | null;
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

  if (rule.lines) {
    // The index just past the Nth newline: everything from there on is behind the fold.
    let seen = 0;
    for (let i = 0; i < text.length; i += 1) {
      if (text[i] !== '\n') continue;
      seen += 1;
      if (seen === rule.lines) {
        cut = i;
        reason = 'lines';
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
