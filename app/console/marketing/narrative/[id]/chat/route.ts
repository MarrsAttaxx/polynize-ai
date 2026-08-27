/**
 * POST /console/marketing/narrative/[id]/chat: one instruction to April (D40).
 *
 * She applies exactly the instruction to the article and the revised article is
 * saved before the response returns, so a reload after a chat edit never loses
 * the edit. The instruction is capped: gate 2 is an editing chat, not a place
 * to paste a new draft.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { llmErrorText } from '@/lib/llm/error-text';
import { getCurrentUser } from '@/lib/console-auth';
import { getNarrative, saveNarrative } from '@/lib/marketing/narrative-store';
import { reviseArticle } from '@/lib/marketing/article-draft';

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

  const body = (await req.json().catch(() => null)) as { instruction?: unknown } | null;
  const instruction =
    typeof body?.instruction === 'string' ? body.instruction.trim().slice(0, 2000) : '';
  if (!instruction) {
    return NextResponse.json({ error: 'say what to change' }, { status: 400 });
  }

  let narrative;
  try {
    narrative = await getNarrative(id);
  } catch (err) {
    console.error('[narrative.chat] read failed:', err);
    return NextResponse.json({ error: 'could not read the narrative' }, { status: 502 });
  }
  if (!narrative) return NextResponse.json({ error: 'narrative not found' }, { status: 404 });
  if (!narrative.article.trim()) {
    return NextResponse.json({ error: 'no article to edit yet' }, { status: 400 });
  }

  try {
    const article = await reviseArticle(narrative.lane, narrative.article, instruction);
    narrative.article = article;
    await saveNarrative(narrative);
    return NextResponse.json({ article });
  } catch (err) {
    console.error('[narrative.chat] revise failed:', err);
    return NextResponse.json(
      { error: llmErrorText(err, 'April') },
      { status: 502 }
    );
  }
}
