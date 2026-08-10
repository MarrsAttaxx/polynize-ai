import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { getEpisode } from '@/lib/marketing/podcast-store';
import { isDescriptConfigured } from '@/lib/descript';
import { EpisodeScreen } from './EpisodeScreen';
import s from '../../piece/[id]/script.module.css';

export const dynamic = 'force-dynamic';

/**
 * One episode's clip workbench.
 *
 * The transcript is NOT sent to the browser. A 56-minute episode is hundreds of kilobytes of text
 * that the page has no use for: every read of it happens server-side, so only the fact that it exists
 * and its size cross the wire.
 */
export default async function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  const ep = await getEpisode(user.email, id);
  if (!ep) {
    return (
      <div className={s.root}>
        <div className={s.notFound}>
          <p>
            No episode <code>{id}</code>.
          </p>
          <Link href="/console/marketing/podcast" className={s.back}>
            ← Episodes
          </Link>
        </div>
      </div>
    );
  }

  const { transcript, ...rest } = ep;
  return (
    <EpisodeScreen
      episode={{ ...rest, transcript_present: Boolean(transcript?.trim()) }}
      descriptConnected={isDescriptConfigured()}
    />
  );
}
