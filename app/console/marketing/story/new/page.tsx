import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { listIdeas } from '@/lib/marketing/idea-store';
import { NewStory, type IdeaRow } from './NewStory';

export const dynamic = 'force-dynamic';

/**
 * Gate 1's server side: the ideas inbox, both lanes merged newest first.
 *
 * Ideas already marked used are hidden rather than shown struck through, because
 * this screen is a chooser and a spent idea is not a choice. They stay in the
 * inbox screens untouched.
 */
export default async function NewStoryPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  const lanes = ['marrs', 'polynize'] as const;
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

  return <NewStory ideas={recent} />;
}
