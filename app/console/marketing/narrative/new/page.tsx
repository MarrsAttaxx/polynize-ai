import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { listIdeas } from '@/lib/marketing/idea-store';
import { STREAMS, isStreamId } from '@/lib/marketing/streams';
import { NewNarrative, type IdeaRow } from './NewNarrative';

export const dynamic = 'force-dynamic';

/**
 * Gate 1's server side: the ideas inbox for the stream we came from (D45).
 *
 * `?stream=` scopes the inbox as well as fixing the lane, because an idea caught for one
 * person is not a candidate for another's narrative. With no stream it falls back to every
 * stream merged, newest first, which is what the screen did before it had an owner.
 *
 * Ideas already marked used are hidden rather than shown struck through, because this screen is
 * a chooser and a spent idea is not a choice. They stay in the inbox screens untouched.
 */
export default async function NewNarrativePage({
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
  const fixedLane = isStreamId(stream) ? stream : undefined;
  const lanes = fixedLane ? [fixedLane] : STREAMS.map((st) => st.id);
  const lists = await Promise.all(
    lanes.map((l) =>
      listIdeas(l).catch(() => [] as Awaited<ReturnType<typeof listIdeas>>)
    )
  );

  // Sort on the ISO timestamp, never on the display string: a localised date like
  // 18/08/2026 string-compares day-first and misorders the moment two months mix.
  const rows: (IdeaRow & { at: string })[] = [];
  lanes.forEach((lane, ix) => {
    for (const i of lists[ix]) {
      if (i.used_at) continue;
      if (!i.text.trim()) continue;
      rows.push({
        id: i.id,
        lane,
        text: i.text.trim(),
        at: i.created_at ?? '',
        when: i.created_at ? new Date(i.created_at).toLocaleDateString('en-AU') : '',
      });
    }
  });
  rows.sort((a, b) => b.at.localeCompare(a.at));
  // The chooser shows a screenful, not the whole archive: the inbox remains the archive.
  const recent = rows.slice(0, 8).map(({ at: _at, ...r }) => r);

  return (
    <NewNarrative
      ideas={recent}
      streams={STREAMS.map((st) => ({ id: st.id, label: st.label }))}
      fixedLane={fixedLane}
    />
  );
}
