import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId, DEFAULT_STREAM } from '@/lib/marketing/streams';
import { getIdea } from '@/lib/marketing/idea-store';
import { IntakeScreen } from './IntakeScreen';

export const dynamic = 'force-dynamic';

/**
 * Intake screen (T5) — the top of the production spine. April interviews the
 * owner in-console (D16) to draw out a concept, then writes the concept doc that
 * feeds the rest of the pipeline. Team-scope only. `?stream=` pre-picks the stream
 * when arriving from a stream card.
 */
export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ stream?: string; idea?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }
  const { stream, idea: ideaId } = await searchParams;
  const initialStream = isStreamId(stream) ? stream : DEFAULT_STREAM;

  /**
   * ARRIVING FROM AN IDEA. The note is loaded here and handed down as text, rather than
   * travelling in the url: a note runs to paragraphs and a query string is the wrong pipe for
   * it. It seeds the INPUT BOX rather than being sent, so he can read it back and edit before
   * April sees it.
   */
  let ideaText = '';
  if (typeof ideaId === 'string' && ideaId) {
    const found = await getIdea(initialStream, ideaId).catch(() => null);
    if (found) ideaText = found.text;
  }
  return <IntakeScreen initialInput={ideaText} owner={user.email} initialStream={initialStream} />;
}
