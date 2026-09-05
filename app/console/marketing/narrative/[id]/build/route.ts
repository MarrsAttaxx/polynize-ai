/**
 * POST /console/marketing/narrative/[id]/build: Gate 3's confirm (D40).
 *
 * The ticks become MASTER pieces: one piece per master asset, not one per
 * scheduled post. The expansion into per-channel posts happens at Gate 5,
 * on the calendar, which already models one entry per channel post. This
 * split matches how the work is actually done: a script is written once and
 * placed nine times.
 *
 * Idempotent on masters: re-confirming with different ticks creates only the
 * masters that are missing and never duplicates or deletes one that exists,
 * because a master may already carry edits or media. An unticked master's
 * placements simply stop being planned at Gate 5.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getCurrentUser } from '@/lib/console-auth';
import { getNarrative, saveNarrative, narrativeHeadline } from '@/lib/marketing/narrative-store';
import { plansForTicks, type MasterAsset } from '@/lib/marketing/kit';
import { listSavedPieces, savePiece, type MarketingPiece } from '@/lib/marketing/piece-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Master asset to the existing format id its editor expects.
 *
 * ZERO NEW FORMAT IDS on purpose: piece.format is read by draft.ts for the prompt shape,
 * by exemplars.ts to pool blessed work by exact format string, and by shoot-queue.ts to
 * decide which rig group raises the touchscreen. Every LinkedIn text frame therefore maps
 * to 'linkedin_text', so no exemplar is orphaned. What makes the frames differ is
 * kit.promptFragment(master), which draft.ts reads alongside the format.
 *
 * Record<MasterAsset, string> is deliberate: adding a master to the union is a compile
 * error until it is mapped here, which is the one guardrail in this chain.
 */
const FORMAT_FOR: Record<MasterAsset, string> = {
  article: 'long_form_written',
  texts: 'linkedin_text',
  texts_hard: 'linkedin_text',
  texts_list: 'linkedin_text',
  texts_field: 'linkedin_text',
  shorts: 'split_screen_short',
  long: 'screen_record_long',
  carousel: 'pdf_carousel',
  images: 'single_image',
};

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

  const body = (await req.json().catch(() => null)) as { ticks?: unknown } | null;
  const ticks = Array.isArray(body?.ticks)
    ? body.ticks.filter((x): x is string => typeof x === 'string').slice(0, 40)
    : [];
  if (ticks.length === 0) {
    return NextResponse.json({ error: 'tick at least one piece' }, { status: 400 });
  }

  let narrative;
  try {
    narrative = await getNarrative(id);
  } catch (err) {
    console.error('[narrative.build] read failed:', err);
    return NextResponse.json({ error: 'could not read the narrative' }, { status: 502 });
  }
  if (!narrative) return NextResponse.json({ error: 'narrative not found' }, { status: 404 });

  const plans = plansForTicks(ticks, narrative.lane);
  if (plans.length === 0) {
    return NextResponse.json({ error: 'nothing recognisable was ticked' }, { status: 400 });
  }

  /**
   * Which masters already exist for this narrative. Keyed on narrative_ref, the durable link,
   * NOT on narrative.piece_ids: confirmed in review that piece_ids gets truncated to the
   * currently ticked masters, so an untick-then-retick minted a duplicate empty master
   * and orphaned the one carrying the script and the media. narrative_ref also survives
   * the other confirmed failure: a mid-loop crash before piece_ids was ever written,
   * whose retry used to recreate every master.
   */
  const existing = new Map<string, MarketingPiece>();
  try {
    for (const p of await listSavedPieces(owner)) {
      if (p.narrative_ref === narrative.id && p.master) existing.set(p.master, p);
    }
  } catch (err) {
    // A failed scan must fail the confirm: proceeding would recreate masters that
    // exist, which is precisely the duplication this map prevents.
    console.error('[narrative.build] piece scan failed:', err);
    return NextResponse.json({ error: 'could not read the pieces. Try again.' }, { status: 502 });
  }

  const headline = narrativeHeadline(narrative.idea, 60);
  const pieceIds: string[] = [];
  try {
    for (const plan of plans) {
      const found = existing.get(plan.master);
      if (found) {
        /**
         * ADOPTION, and the retitle that has to come with it. A v1 narrative's text piece was
         * called "<headline>: 4 text posts" and carries master 'texts', which now means the
         * contrarian frame. Keeping the old title would leave a card whose name disagrees
         * with its content, and wave/route.ts stamps that title onto every calendar entry it
         * creates, so the wrong name would travel all the way to the week grid.
         *
         * The body, script, media and hooks are untouched: only the label changes.
         */
        const wanted = `${headline}: ${plan.label}`;
        if (found.title !== wanted) {
          try {
            await savePiece(owner, { ...found, title: wanted });
          } catch (err) {
            // A failed retitle is cosmetic. The piece still works, so do not fail the confirm.
            console.error('[narrative.build] retitle failed:', err);
          }
        }
        pieceIds.push(found.piece_id);
        continue;
      }
      const piece: MarketingPiece = {
        piece_id: randomUUID(),
        owner,
        stream: narrative.lane,
        format: FORMAT_FOR[plan.master],
        title: `${headline}: ${plan.label}`,
        script: '',
        kind: plan.kind,
        status: 'draft',
        narrative_ref: narrative.id,
        // The Story's use case rides onto the piece (D96), so every entry and link made from it is labelled.
        ...(narrative.use_case ? { use_case: narrative.use_case } : {}),
        master: plan.master,
        platforms: plan.placements.map((p) => p.network),
        provenance: 'ai_generated',
      };
      // The article master arrives with its body already written: the article IS
      // the deliverable, approved at gate 2. Everything else starts empty.
      if (plan.master === 'article') piece.body = narrative.article;
      await savePiece(owner, piece);
      pieceIds.push(piece.piece_id);
    }

    narrative.kit = ticks;
    narrative.piece_ids = pieceIds;
    narrative.gate = 4;
    await saveNarrative(narrative);
  } catch (err) {
    console.error('[narrative.build] piece creation failed:', err);
    return NextResponse.json({ error: 'could not create the pieces' }, { status: 500 });
  }

  return NextResponse.json({ narrative, pieces: pieceIds.length });
}
