import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId, streamLabel } from '@/lib/marketing/streams';
import { listMediaForStream, type MediaAsset } from '@/lib/marketing/media-store';
import { MediaLibrary } from './MediaLibrary';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import s from './media.module.css';

export const dynamic = 'force-dynamic';

/**
 * A stream's media library (D2 amended 2026-07-14). A grid of reusable assets
 * (photos, video) referenced by public direct link (Box live links, etc.). Assets
 * added here become selectable when producing a piece in this stream, and ride to
 * the actual scheduled post via Metricool. Team-scope only.
 */
export default async function MediaPage({
  params,
}: {
  params: Promise<{ stream: string }>;
}) {
  const { stream } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  if (!isStreamId(stream)) {
    return (
      <div className={s.root}>
        <Link href="/console/marketing" className={s.back}>
          ← Marketing
        </Link>
        <p className={s.notFound}>
          Unknown stream <code>{stream}</code>.
        </p>
      </div>
    );
  }

  let initial: MediaAsset[] = [];
  try {
    initial = await listMediaForStream(stream);
  } catch (err) {
    console.error('[media] read failed:', err);
  }

  return (
    <div className={s.root}>
      <header className={s.head}>
        <BackLink
          fallbackHref={`/console/marketing/stream/${stream}`}
          className={s.back}
        />
        <span className={s.eyebrow}>media library · {streamLabel(stream)}</span>
        <h1 className={s.title}>Media library</h1>
        <p className={s.sub}>
          The reusable footage and images this stream&rsquo;s posts are built from.
          Add a Box live link (or any public direct link) and it becomes selectable
          when you produce a piece, then rides to the actual post.
        </p>
      </header>
      <MediaLibrary stream={stream} initial={initial} />
    </div>
  );
}
