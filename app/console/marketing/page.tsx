import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { listStoryCards, GATE_LABELS, type StoryCard } from '@/lib/marketing/story-store';
import b from './board.module.css';

export const dynamic = 'force-dynamic';

/**
 * THE BOARD (D40): every Story sitting at its gate. This replaced the stream-cards
 * dashboard as the marketing home on Marrs's decision ("the board replaces the
 * marketing home"), because the unit of work is now a Story moving through gates,
 * not a stream holding loose pieces. The old dashboard is not deleted: it lives at
 * /console/marketing/streams, because brand voice, series, media and the concept
 * library still live inside streams and parts of that design will be repurposed.
 *
 * One list per gate, in gate order, so the eye reads it as a production line:
 * what is waiting to be developed, what is being written, what is being made,
 * what is ready to ship. Shipped is the scoreboard at the end, not a graveyard.
 */
export default async function BoardPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  let cards: StoryCard[] = [];
  try {
    cards = await listStoryCards();
  } catch (err) {
    console.error('[board] story list failed:', err);
  }

  const order: (1 | 2 | 3 | 4 | 5 | 'shipped')[] = [1, 2, 3, 4, 5, 'shipped'];
  const byGate = new Map<string, StoryCard[]>();
  for (const g of order) byGate.set(String(g), []);
  for (const c of cards) byGate.get(String(c.gate))?.push(c);

  return (
    <main className={b.root}>
      <header className={b.head}>
        <div>
          <p className={b.kicker}>Marketing engine</p>
          <h1 className={b.title}>The board</h1>
        </div>
        <div className={b.headActions}>
          <Link href="/console/marketing/calendar" className={b.ghost}>
            Calendar
          </Link>
          <Link href="/console/marketing/streams" className={b.ghost}>
            Streams and setup
          </Link>
          <Link href="/console/marketing/story/new" className={b.new}>
            New story →
          </Link>
        </div>
      </header>

      {cards.length === 0 ? (
        <div className={b.empty}>
          <p>No stories yet. A story starts as an idea and leaves as a week of content.</p>
          <Link href="/console/marketing/story/new" className={b.new}>
            Start the first one →
          </Link>
        </div>
      ) : (
        order.map((g) => {
          const list = byGate.get(String(g)) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={String(g)} className={b.lane}>
              <h2 className={b.laneName}>
                {g === 'shipped' ? 'Shipped' : `Gate ${g} · ${GATE_LABELS[String(g)]}`}
                <span className={b.count}>{list.length}</span>
              </h2>
              <div className={b.cards}>
                {list.map((c) => (
                  <Link
                    key={c.id}
                    href={`/console/marketing/story/${c.id}`}
                    className={b.card}
                  >
                    <span className={`${b.laneTag} ${c.lane === 'marrs' ? b.ma : b.pz}`}>
                      {c.lane === 'marrs' ? 'Marrs Attacks' : 'Polynize'}
                    </span>
                    <span className={b.headline}>{c.headline}</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })
      )}
    </main>
  );
}
