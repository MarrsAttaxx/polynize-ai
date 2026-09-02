import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { listEntries, type CalendarEntry } from '@/lib/marketing/calendar-store';
import { CalendarBoard } from './CalendarBoard';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import s from './calendar.module.css';

export const dynamic = 'force-dynamic';

/**
 * The publishing calendar (Step 1) — the shared view of what is going out, across
 * every stream. Reads the console's own calendar entries; usable before Metricool
 * is wired. Team-scope only; owner from the session.
 */
export default async function CalendarPage({
  searchParams,
}: {
  /** `?prepared=N` after a piece was prepared, so the board can say how many posts it made (D81). */
  searchParams: Promise<{ prepared?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  const { prepared } = await searchParams;
  const preparedCount = Number.parseInt(prepared ?? '', 10);

  let entries: CalendarEntry[] = [];
  try {
    entries = await listEntries(user.email);
  } catch (err) {
    console.error('[calendar] list failed:', err);
  }

  return (
    <div className={s.root}>
      <header className={s.head}>
        <BackLink fallbackHref="/console/marketing" className={s.back} />
        <span className={s.eyebrow}>publishing calendar</span>
        <h1 className={s.title}>Calendar</h1>
        <p className={s.sub}>
          What is going out, across every stream. Set a date on each post to plan it,
          then Schedule it to send it to Metricool.{' '}
          <Link href="/console/marketing/metricool" className={s.connectLink}>
            Connect Metricool →
          </Link>
        </p>
      </header>
      <CalendarBoard
        initial={entries}
        prepared={Number.isFinite(preparedCount) && preparedCount > 0 ? preparedCount : undefined}
      />
    </div>
  );
}
