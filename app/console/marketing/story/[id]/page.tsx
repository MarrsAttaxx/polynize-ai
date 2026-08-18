import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { getStory } from '@/lib/marketing/story-store';
import { getPiece } from '@/lib/marketing/piece-store';
import { listEntries } from '@/lib/marketing/calendar-store';
import { isMetricoolConfigured } from '@/lib/marketing/metricool-client';
import { NETWORKS } from '@/lib/marketing/channel-schedule';
import { StoryGates, type WaveData } from './StoryGates';

export const dynamic = 'force-dynamic';

/**
 * The story screen (D40): loads the story and whatever its CURRENT gate needs,
 * then hands over to the client component. Gate 4 needs the master pieces;
 * gate 5 and shipped need the wave as it actually sits on the calendar. Earlier
 * gates need nothing beyond the story, and this page deliberately does not load
 * what the gate on screen cannot show.
 */
export default async function StoryPage({
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

  let story;
  try {
    story = await getStory(id);
  } catch (err) {
    console.error('[story] read failed:', err);
    story = null;
  }
  if (!story) notFound();

  // Gate 4: the master pieces, video first because it is the long pole.
  const pieces: { id: string; label: string; master: string; kind: string; href: string }[] = [];
  if (story.gate === 4 || story.gate === 5 || story.gate === 'shipped') {
    for (const pid of story.piece_ids ?? []) {
      try {
        const p = await getPiece(owner, pid);
        if (!p) continue;
        pieces.push({
          id: p.piece_id,
          label: p.title,
          master: p.master ?? '',
          kind: p.kind ?? 'text',
          href: `/console/marketing/piece/${p.piece_id}`,
        });
      } catch (err) {
        console.error('[story] piece read failed:', err);
      }
    }
    pieces.sort((a, b) => {
      const rank = (k: string) => (k === 'video' ? 0 : k === 'image' ? 1 : 2);
      return rank(a.kind) - rank(b.kind);
    });
  }

  // Gates 5 and shipped: the wave as the calendar actually holds it.
  const wave: WaveData = {
    planned: false,
    cells: [],
    days: [],
    networks: [],
    count: 0,
    live: 0,
    metricoolReady: isMetricoolConfigured(),
  };
  if (story.gate === 5 || story.gate === 'shipped') {
    try {
      const ids = new Set(story.piece_ids ?? []);
      const entries = (await listEntries(owner)).filter(
        (e) => e.piece_id && ids.has(e.piece_id) && e.scheduled_at
      );
      wave.planned = entries.length > 0;
      wave.count = entries.length;
      wave.live = entries.filter(
        (e) => e.status === 'scheduled' || e.status === 'published'
      ).length;

      const dayKeys = [...new Set(entries.map((e) => (e.scheduled_at ?? '').slice(0, 10)))].sort();
      const dayLabel = (d: string) => {
        const dt = new Date(`${d}T00:00:00`);
        return dt.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' });
      };
      wave.days = dayKeys.map(dayLabel);
      wave.networks = NETWORKS.filter((n) => entries.some((e) => e.channel === n));

      // A readable chip per entry: the master's short name plus its order on the day.
      const short: Record<string, string> = {
        article: 'Article',
        texts: 'Post',
        shorts: 'Short',
        long: 'Long',
        carousel: 'Carousel',
        images: 'Image',
      };
      const masterOf = new Map<string, { master: string; kind: string }>();
      for (const p of pieces) masterOf.set(p.id, { master: p.master, kind: p.kind });
      const seq = new Map<string, number>();
      for (const e of [...entries].sort((a, b) =>
        (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '')
      )) {
        const m = masterOf.get(e.piece_id ?? '');
        const key = `${e.channel}:${m?.master ?? 'x'}`;
        const n = (seq.get(key) ?? 0) + 1;
        seq.set(key, n);
        wave.cells.push({
          day: dayLabel((e.scheduled_at ?? '').slice(0, 10)),
          network: e.channel,
          label: `${short[m?.master ?? ''] ?? 'Post'}${n > 1 || (m && (m.master === 'shorts' || m.master === 'texts' || m.master === 'images')) ? ` ${n}` : ''}`,
          video: m?.kind === 'video',
        });
      }
    } catch (err) {
      console.error('[story] wave read failed:', err);
    }
  }

  return <StoryGates initial={story} pieces={pieces} wave={wave} />;
}
