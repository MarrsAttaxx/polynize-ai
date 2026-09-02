import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId, streamLabel } from '@/lib/marketing/streams';
import { listMediaForStream, type MediaAsset } from '@/lib/marketing/media-store';
import { listSavedPieces } from '@/lib/marketing/piece-store';
import { FINISHED_MEDIA_FORMAT } from '@/lib/marketing/finished-media';
import { MediaLibrary } from './MediaLibrary';
import { MediaGenerate } from './MediaGenerate';
import { MediaEdit } from './MediaEdit';
import { MediaTextOverlay } from './MediaTextOverlay';
import { MediaTabs } from './MediaTabs';
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

  /**
   * WHICH FILES ALREADY HAVE A POST BEING WRITTEN (D80), so the button on the tile can say whether
   * it starts one or reopens one. A read failure costs the labels and nothing else: the door still
   * opens, and the route is idempotent on its own, so it reopens the same piece regardless.
   */
  const posted: Record<string, string> = {};
  try {
    for (const p of await listSavedPieces(user.email)) {
      if (p.stream !== stream || p.format !== FINISHED_MEDIA_FORMAT || p.narrative_ref) continue;
      for (const id of p.media ?? []) posted[id] = p.piece_id;
    }
  } catch (err) {
    console.error('[media] finished-media piece scan failed:', err);
  }

  return (
    <div className={s.root}>
      <header className={s.head}>
        <BackLink
          fallbackHref={`/console/marketing/stream/${stream}`}
          className={s.back}
          dashboardHref={`/console/marketing/stream/${stream}`}
        />
        <span className={s.eyebrow}>media library · {streamLabel(stream)}</span>
        <h1 className={s.title}>Media library</h1>
        <p className={s.sub}>
          The reusable footage and images this stream&rsquo;s posts are built from.
          Add a Box live link (or any public direct link) and it becomes selectable
          when you produce a piece, then rides to the actual post. For something already
          finished, press <strong>Post this</strong> on the file: it writes the caption,
          picks the platforms, and puts it on the calendar with no Story needed.
        </p>
      </header>
      {/* FOUR TABS, NOT A STACK (D85). Built here on the server exactly as before and handed to a
          client shell that only decides which one is visible. */}
      <MediaTabs
        library={<MediaLibrary stream={stream} initial={initial} posted={posted} />}
        generate={
          <MediaGenerate stream={stream} images={initial.filter((m) => m.kind === 'image')} />
        }
        edit={<MediaEdit stream={stream} images={initial.filter((m) => m.kind === 'image')} />}
        overlay={
          <MediaTextOverlay stream={stream} images={initial.filter((m) => m.kind === 'image')} />
        }
      />
    </div>
  );
}
