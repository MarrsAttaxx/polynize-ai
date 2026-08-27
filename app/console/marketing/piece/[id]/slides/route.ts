/**
 * POST /console/marketing/piece/[id]/slides
 *
 * April writes the slide narrative for an image piece: the visual world, the caption, and
 * one headline plus one background prompt per slide. Ten for a carousel, one for a card.
 *
 * Nothing is persisted here. The screen shows the plan, the operator runs it slide by
 * slide, and it goes back through the existing /state autosave, so there stays one
 * validated write path onto a piece (same discipline as the hooks route). Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { llmErrorText } from '@/lib/llm/error-text';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece } from '@/lib/marketing/piece-store';
import { DraftError, scriptModelInUse } from '@/lib/marketing/draft';
import { proposeSlidePlan } from '@/lib/marketing/slide-propose';
import { TEMPLATES, LEGACY_TEMPLATE, brandHexOr, type SlideTemplate } from '@/lib/marketing/slide-plan';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * 300, not 120. The LLM client aborts at 240s by design so its own honest "timed out" message
 * is the one that fires; at 120 Vercel killed the function first and a slow ten slide plan
 * reached him as "Network error", which is the least diagnosable message on the screen.
 */
export const maxDuration = 300;

/** A steer is a note, not a document. Capped so it cannot crowd out the source. */
const MAX_STEER = 4000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const owner = user.email;

  let steer = '';
  /**
   * THE TEMPLATE ARRIVES WITH THE REQUEST, because it is chosen before she writes anything and
   * it decides what she is asked for. An unknown value falls back to the legacy full frame
   * rather than 400ing: a bad picker value must not stop him writing slides.
   */
  let template: SlideTemplate = LEGACY_TEMPLATE;
  let accent = '#69fccb';
  let kicker = '';
  const body = (await req.json().catch(() => null)) as {
    steer?: unknown;
    template?: unknown;
    accent?: unknown;
    kicker?: unknown;
  } | null;
  if (body && typeof body.steer === 'string') steer = body.steer.slice(0, MAX_STEER);
  if (body && typeof body.template === 'string' && (TEMPLATES as string[]).includes(body.template)) {
    template = body.template as SlideTemplate;
  }
  accent = brandHexOr(body?.accent, accent);
  if (body && typeof body.kicker === 'string') kicker = body.kicker.trim().slice(0, 40);

  let piece;
  try {
    piece = await getPiece(owner, id);
  } catch (err) {
    console.error('[slides] piece read failed:', err);
    return NextResponse.json({ error: 'could not read the piece' }, { status: 502 });
  }
  if (!piece) return NextResponse.json({ error: 'piece not found' }, { status: 404 });

  try {
    const plan = await proposeSlidePlan(owner, piece, { template, accent, kicker, steer });
    return NextResponse.json({ plan, model: scriptModelInUse() });
  } catch (e) {
    if (e instanceof DraftError) {
      if (e.reason === 'no-concept') {
        return NextResponse.json(
          { error: 'No article to work from. Re-confirm this narrative at gate 3.' },
          { status: 400 }
        );
      }
      if (e.reason === 'empty') {
        /**
         * Only reachable now when there was genuinely nothing usable in the response. A
         * truncated or oddly wrapped answer is salvaged rather than rejected (D49), so a retry
         * really is the right advice here rather than a shrug, and the server log carries the
         * model, the length and both ends of what came back.
         */
        return NextResponse.json(
          {
            error:
              'April returned nothing usable for the slides. Try again, and if it happens twice shorten what you wrote in the box.',
          },
          { status: 502 }
        );
      }
    }
    return NextResponse.json(
      { error: llmErrorText(e, 'The writing assistant') },
      { status: 502 }
    );
  }
}
