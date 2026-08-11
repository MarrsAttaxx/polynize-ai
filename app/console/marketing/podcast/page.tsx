import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { listEpisodes } from '@/lib/marketing/podcast-store';
import { isDescriptConfigured } from '@/lib/descript';
import { isStreamId, streamLabel, DEFAULT_STREAM } from '@/lib/marketing/streams';
import { NewEpisode } from './NewEpisode';
import { DeleteEpisode } from './DeleteEpisode';
import { DoneEpisode } from './DoneEpisode';
import s from '../../_components/client-card.module.css';
import l from '../../_components/launcher.module.css';
import d from './podcast.module.css';

export const dynamic = 'force-dynamic';

/**
 * PODCAST EPISODES: the source material for the clip series.
 *
 * Reached from a stream's Podcasts section rather than from the marketing dashboard, because an
 * episode belongs to a stream the way a concept does (Marrs: "it actually belongs within the Polynize
 * stream of content"). `?stream=` scopes the list and pre-picks the stream on the form; without it,
 * every episode is listed.
 */
export default async function PodcastPage({
  searchParams,
}: {
  searchParams: Promise<{ stream?: string; new?: string }>;
}) {
  const { stream: wanted, new: openNew } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  const stream = wanted && isStreamId(wanted) ? wanted : undefined;
  const all = await listEpisodes(user.email).catch((err) => {
    console.error('[podcast] list failed:', err);
    return [];
  });
  const scoped = stream ? all.filter((e) => (e.stream || DEFAULT_STREAM) === stream) : all;
  // DONE episodes leave the list. Marrs asked for this once Ep06 had clips out of it: the list should
  // show what still needs work, and everything ever recorded would drown that.
  const episodes = scoped.filter((e) => !e.done);
  const finished = scoped.filter((e) => e.done);

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.dashboard}>
        <div className={s.header}>
          <Link
            href={stream ? `/console/marketing/stream/${stream}` : '/console/marketing'}
            className={s.marketingBack}
          >
            ← {stream ? streamLabel(stream) : 'Marketing'}
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

        <NewEpisode defaultStream={stream} startOpen={openNew === '1'} />

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
                (c) =>
                  c.status === 'approved' ||
                  c.status === 'assembling' ||
                  c.status === 'assembled'
              ).length;
              const done = ep.clips.filter((c) => c.status === 'assembled').length;
              return (
                // The card and the delete control are SIBLINGS. Nesting a button inside the Link
                // would put one interactive element inside another, which breaks keyboard use and
                // makes the click target ambiguous.
                <div key={ep.episode_id} className={d.cardWrap}>
                  <Link
                    href={`/console/marketing/podcast/${ep.episode_id}`}
                    className={l.card}
                  >
                    <span className={l.cardEyebrow}>
                      {ep.number ? `Episode ${ep.number}` : 'Episode'}
                      {!stream ? ` · ${streamLabel(ep.stream || DEFAULT_STREAM)}` : ''}
                    </span>
                    <span className={l.cardTitle}>{ep.title}</span>
                    <span className={l.cardDesc}>
                      {proposed === 0
                        ? ep.transcript_chars
                          ? 'Transcript in. No clips proposed yet.'
                          : 'No transcript yet.'
                        : `${proposed} proposed · ${approved} approved · ${done} cut`}
                    </span>
                    <span className={l.cardArrow} aria-hidden>
                      →
                    </span>
                  </Link>
                  <div className={d.cardActions}>
                    <DoneEpisode episodeId={ep.episode_id} done={false} />
                    <DeleteEpisode episodeId={ep.episode_id} title={ep.title} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {finished.length ? (
          <details className={d.dropped} style={{ marginTop: 26 }}>
            <summary>{finished.length} done</summary>
            {finished.map((ep) => (
              <div key={ep.episode_id} className={d.droppedRow}>
                <span>
                  {ep.number ? `Episode ${ep.number}: ` : ''}
                  {ep.title}
                </span>
                <DoneEpisode episodeId={ep.episode_id} done />
                <DeleteEpisode episodeId={ep.episode_id} title={ep.title} />
              </div>
            ))}
          </details>
        ) : null}
      </div>
    </>
  );
}
