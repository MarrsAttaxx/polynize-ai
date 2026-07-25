/**
 * TEMPORARY: verify the D29 two-track script shape end-to-end through the REAL
 * draft path (format scriptShape + starter template recipe + brand voice). Writes a
 * throwaway concept under a probe-only owner, drafts, then deletes it, so no real
 * data is touched. Returns the script to eyeball. No secrets. DELETE after use.
 *
 * GET /api/diagnostics/twotrack?format=split_screen_short|screen_record_long
 */

import { NextResponse } from 'next/server';
import { draftVideoScript } from '@/lib/marketing/draft';
import { saveConcept, deleteConcept } from '@/lib/marketing/concept-store';
import type { MarketingPiece } from '@/lib/marketing/piece-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const PROBE_OWNER = 'twotrack-probe@polynize.invalid';

const BODY = `## Framing
Strip the AI out first: map the actual work before you buy software.

## Key beats
- A services firm's proposal process was stalling their pipeline: high-value bids took a full day to write.
- The reason: the judgement to write a winning bid lived in senior partners who had left.
- Their instinct was to buy a generic AI writing tool.
- Instead we mapped the actual capability: the steps, the decisions, what a winning bid contained.
- Only then did we rebuild it, and only then decide where AI genuinely helped.

## Proof
Bids that took a full day now take under two hours. Buying the tool first would only have automated a broken process faster.

## The point
If you cannot describe the work, you cannot automate it.
`;

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get('format') ?? 'split_screen_short';
  const templateId =
    format === 'screen_record_long' ? 'touchscreen-walkthrough' : 'touchscreen-concept-flip';

  let slug: string | undefined;
  try {
    const concept = await saveConcept(
      {
        owner: PROBE_OWNER,
        stream: 'polynize',
        framing: 'Two track probe strip the AI out first',
        title: 'Two-track probe',
        body_md: BODY,
      },
      { forceNew: true }
    );
    slug = concept.framing_slug;

    const piece = {
      piece_id: 'probe',
      owner: PROBE_OWNER,
      stream: 'polynize',
      format,
      kind: 'video',
      title: concept.title,
      concept_ref: concept.concept_ref,
      template_ref: `library:${templateId}`,
      script: '',
    } as MarketingPiece;

    const script = await draftVideoScript(PROBE_OWNER, piece);
    return NextResponse.json({ format, templateId, script });
  } catch (e) {
    return NextResponse.json(
      { format, templateId, error: e instanceof Error ? e.message : String(e) },
      { status: 200 }
    );
  } finally {
    if (slug) await deleteConcept(PROBE_OWNER, slug).catch(() => {});
  }
}
