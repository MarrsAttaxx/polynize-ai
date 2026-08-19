import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece, type MarketingPiece } from '@/lib/marketing/piece-store';
import { conceptBodyForPiece } from '@/lib/marketing/draft';
import { kindOf } from '@/lib/marketing/output-plan';
import { ScriptScreen } from './ScriptScreen';
import { scaffoldScript } from '@/lib/marketing/concept-parse';
import { TextOutputScreen } from './TextOutputScreen';
import s from './script.module.css';

export const dynamic = 'force-dynamic';

/**
 * A single content piece — Phase 1 opens on the Script screen (the swappable
 * middle's first stage for short-form video). Team-scope only; a saved piece
 * wins, otherwise a Phase-1 seed is used.
 */
export default async function MarketingPiecePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  // The layout renders the SignInGate when there is no user.
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  const owner = user.email;
  // Degrade gracefully: if storage is unreachable (e.g. the Supabase project is
  // paused), the piece reads as null and the screen shows "not found" instead of
  // the whole page 500-ing.
  let piece: MarketingPiece | null = null;
  try {
    piece = await getPiece(owner, id);
  } catch (err) {
    console.error('[marketing] piece read failed:', err);
  }

  if (!piece) {
    return (
      <div className={s.root}>
        <div className={s.notFound}>
          <p>No piece <code>{id}</code> yet.</p>
          <Link href="/console/marketing" className={s.back}>
            ← Marketing
          </Link>
        </div>
      </div>
    );
  }

  /**
   * The source text behind this piece, for April's chat AND for the operator to read.
   *
   * Resolved through conceptBodyForPiece so this page cannot disagree with what the
   * draft routes use: a Gates piece resolves to its story's ARTICLE, a streams piece
   * to its concept doc. Marrs hit the disagreement on the first walkthrough, in Gate
   * 4: "I can't remember what the script is. I need a version of the script here I
   * can look at", and every draft button answered "no concept to work from".
   */
  const conceptBody = (await conceptBodyForPiece(owner, piece).catch((err) => {
    console.error('[marketing] source read for the piece screen failed:', err);
    return '';
  })) || undefined;

  // What to call it on screen, since the two eras of piece have different sources.
  const sourceLabel = piece.story_ref ? 'The article' : 'The concept';

  // Non-video pieces (text) open on the text output screen; video on the script
  // screen. Both carry the on-screen April chat.
  const kind = piece.kind ?? kindOf(piece.format);
  if (kind === 'text') {
    return (
      <TextOutputScreen
        initial={piece}
        conceptBody={conceptBody}
        sourceLabel={sourceLabel}
      />
    );
  }
  /**
   * IS THE SCRIPT REAL, OR STILL THE SEEDED PLACEHOLDER?
   *
   * createOutputs seeds every video piece with `scaffoldScript(...)`, so a brand new piece has a
   * non-empty `script` that nobody wrote. The staged build has to know the difference: treating
   * the scaffold as a finished script would collapse the panel on exactly the pieces that need
   * it most, which is every new one. The old auto-draft made the same comparison for the same
   * reason; it is decided here because only the server has the concept to rebuild it from.
   */
  const scriptIsScaffold =
    !piece.script?.trim() ||
    (conceptBody !== undefined &&
      piece.script.trim() === scaffoldScript(piece.framing ?? '', conceptBody).trim());

  return (
    <ScriptScreen
      initial={piece}
      conceptBody={conceptBody}
      sourceLabel={sourceLabel}
      scriptIsScaffold={scriptIsScaffold}
    />
  );
}
