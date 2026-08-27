/**
 * POST /console/marketing/narrative/[id]/draft: April writes the article (D40).
 *
 * Gate 2 calls this on first view when the article is empty, and the redraft
 * path can call it again. The article is the long form: it publishes as-is
 * later and every other piece is cut from it, so this is the single most
 * consequential LLM call in the pipeline.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { llmErrorText } from '@/lib/llm/error-text';
import { getCurrentUser } from '@/lib/console-auth';
import { getNarrative, saveNarrative } from '@/lib/marketing/narrative-store';
import { draftArticle } from '@/lib/marketing/article-draft';
import { scriptModelInUse } from '@/lib/marketing/draft';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { force?: unknown } | null;
  const force = body?.force === true;

  let narrative;
  try {
    narrative = await getNarrative(id);
  } catch (err) {
    console.error('[narrative.draft] read failed:', err);
    return NextResponse.json({ error: 'could not read the narrative' }, { status: 502 });
  }
  if (!narrative) return NextResponse.json({ error: 'narrative not found' }, { status: 404 });

  // A draft is only ever written over EMPTINESS unless forced. Confirmed in review:
  // a reload aborts the browser's fetch but not this handler, so an abandoned call
  // used to finish minutes later and overwrite an article the operator had already
  // edited. The same guard is re-checked after the LLM returns for the same reason.
  if (narrative.article.trim() && !force) {
    return NextResponse.json({ article: narrative.article, model: scriptModelInUse() });
  }

  try {
    const article = await draftArticle(narrative.lane, narrative.idea);
    const fresh = await getNarrative(id);
    if (!fresh) return NextResponse.json({ error: 'narrative not found' }, { status: 404 });
    if (fresh.article.trim() && !force) {
      return NextResponse.json({ article: fresh.article, model: scriptModelInUse() });
    }
    fresh.article = article;
    await saveNarrative(fresh);
    return NextResponse.json({ article, model: scriptModelInUse() });
  } catch (err) {
    console.error('[narrative.draft] draft failed:', err);
    return NextResponse.json(
      { error: llmErrorText(err, 'April') },
      { status: 502 }
    );
  }
}
