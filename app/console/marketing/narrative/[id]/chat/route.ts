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
import { captureFeedback } from '@/lib/marketing/feedback-capture';

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

  /**
   * FEEDBACK FIRST (D93). On this screen April is writing the article, so an unqualified note lands
   * on that job. The narrative is read below for its lane, which scopes a note he widens to the
   * stream, so the capture happens after the read rather than before it.
   */
  let narrative;
  try {
    narrative = await getNarrative(id);
  } catch (err) {
    console.error('[narrative.chat] read failed:', err);
    return NextResponse.json({ error: 'could not read the narrative' }, { status: 502 });
  }
  if (!narrative) return NextResponse.json({ error: 'narrative not found' }, { status: 404 });

  /**
   * Before the article check, on purpose: a rule about how she writes is worth recording whether or
   * not there is an article on screen to apply it to yet.
   */
  const captured = await captureFeedback(instruction, user.email, {
    stream: narrative.lane,
    job: 'article',
    from: id,
  });
  if (captured) {
    if (!captured.stored) {
      return NextResponse.json({ error: captured.error }, { status: 500 });
    }
    /**
     * THE ARTICLE COMES BACK UNCHANGED, deliberately. This client only acts when it sees an
     * `article`, so returning none would leave the chat saying "that did not work" for a note that
     * was stored perfectly. Sending the current text back is a no-op for the document and lets the
     * confirmation reach him through `note`.
     */
    return NextResponse.json({ article: narrative.article, note: captured.said });
  }

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
