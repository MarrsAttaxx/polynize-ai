import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { IntakeScreen } from './IntakeScreen';

export const dynamic = 'force-dynamic';

/**
 * Intake screen (T5) — the top of the production spine. April interviews the
 * owner in-console (D16) to draw out a concept, then writes the concept doc that
 * feeds the rest of the pipeline. Team-scope only.
 */
export default async function IntakePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }
  return <IntakeScreen owner={user.email} />;
}
