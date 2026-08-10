import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { listEpisodes } from '@/lib/marketing/podcast-store';
import { isDescriptConfigured } from '@/lib/descript';
import { NewEpisode } from './NewEpisode';
import s from '../../_components/client-card.module.css';
import l from '../../_components/launcher.module.css';

export const dynamic = 'force-dynamic';

/**
 * PODCAST EPISODES: the source material for the clip series.
 *
 * An episode sits beside concepts rather than inside one, because it is not an idea the business
 * argues, it is a recording that already exists. What comes OUT of it are ordinary pieces, so this
 * page is a mine head and not a parallel pipeline.
 */
export default async function PodcastPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  const episodes = await listEpisodes(user.email).catch((err) => {
    console.error('[podcast] list failed:', err);
    return [];
  });

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.dashboard}>
        <div className={s.header}>
          <Link href="/console/marketing" className={s.marketingBack}>
            ← Marketing
          </Link>
          <div className={s.eyebrow}>podcast clips</div>
          <h1 className={s.title}>Episodes</h1>
        </div>

        {!isDescriptConfigured() ? (
          <p className={s.errorMessage}>
            Descript is not connected, so transcripts cannot be pulled and clips cannot be cut. Add
            DESCRIPT_API_TOKEN in Vercel and redeploy. You can still paste a transcript and get clip
            proposals in the meantime.
          </p>
        ) : null}

        <NewEpisode />

        {episodes.length === 0 ? (
          <p className={l.placeholderNote}>
            No episodes yet. Add one, point it at its Descript project, and April will propose the
            clips worth cutting.
          </p>
        ) : (
          <div className={l.cards}>
            {episodes.map((ep) => {
              const proposed = ep.clips.length;
              const approved = ep.clips.filter(
                (c) => c.status === 'approved' || c.status === 'assembling' || c.status === 'assembled'
              ).length;
              const done = ep.clips.filter((c) => c.status === 'assembled').length;
              return (
                <Link
                  key={ep.episode_id}
                  href={`/console/marketing/podcast/${ep.episode_id}`}
                  className={l.card}
                >
                  <span className={l.cardEyebrow}>
                    {ep.number ? `Episode ${ep.number}` : 'Episode'}
                  </span>
                  <span className={l.cardTitle}>{ep.title}</span>
                  <span className={l.cardDesc}>
                    {proposed === 0
                      ? ep.transcript
                        ? 'Transcript in. No clips proposed yet.'
                        : 'No transcript yet.'
                      : `${proposed} proposed · ${approved} approved · ${done} cut`}
                  </span>
                  <span className={l.cardArrow} aria-hidden>
                    →
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
