import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece, type MarketingPiece } from '@/lib/marketing/piece-store';
import { Teleprompter } from './Teleprompter';

export const dynamic = 'force-dynamic';

/**
 * Teleprompter view (T3) — its own URL (iPad-ready), chrome-less, section by
 * section, remote-advanceable. Reads the same piece as the Script screen so it
 * always reflects the latest saved script.
 */
function toSections(script: string): string[] {
  return script
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
}

export default async function TeleprompterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  const owner = user.email;
  let piece: MarketingPiece | null = null;
  try {
    piece = await getPiece(owner, id);
  } catch (err) {
    console.error('[teleprompter] piece read failed:', err);
  }
  if (!piece) return null;

  return (
    <Teleprompter
      title={piece.title}
      sections={toSections(piece.script ?? '')}
      backHref={`/console/marketing/piece/${id}`}
    />
  );
}
