import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId, DEFAULT_STREAM } from '@/lib/marketing/streams';
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
  searchParams: Promise<{ stream?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }
  const { stream } = await searchParams;
  const initialStream = isStreamId(stream) ? stream : DEFAULT_STREAM;
  return <IntakeScreen owner={user.email} initialStream={initialStream} />;
}
