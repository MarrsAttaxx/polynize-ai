import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece, type MarketingPiece } from '@/lib/marketing/piece-store';
import { getScene } from '@/lib/marketing/scene-store';
import { ScreenPromptScreen } from './ScreenPromptScreen';
import s from '../script.module.css';

export const dynamic = 'force-dynamic';

/**
 * The Screen Prompt stage for a piece (D31): the PRE-RECORD plan for what the
 * touchscreen does, its own stage between Script and Record because it is a real gate
 * (the screen has to exist before the shoot). Team-scope only; owner from session.
 */
export default async function PieceScreenPromptPage({
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

  let piece: MarketingPiece | null = null;
  try {
    piece = await getPiece(user.email, id);
  } catch (err) {
    console.error('[screen-prompt] piece read failed:', err);
  }

  if (!piece) {
    return (
      <div className={s.root}>
        <div className={s.notFound}>
          <p>
            No piece <code>{id}</code> yet.
          </p>
          <Link href="/console/marketing" className={s.back}>
            ← Marketing
          </Link>
        </div>
      </div>
    );
  }

  // The scene as it stands, so the stage opens on what is already on the touchscreen.
  const scene = await getScene(id).catch(() => null);

  return <ScreenPromptScreen initial={piece} scene={scene ?? null} />;
}
