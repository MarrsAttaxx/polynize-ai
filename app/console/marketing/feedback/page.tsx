import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { STREAMS, streamLabel } from '@/lib/marketing/streams';
import { listNotes } from '@/lib/marketing/feedback-store';
import { applyTo, NOTES_PER_SCOPE, type FeedbackNote } from '@/lib/marketing/feedback';
import { FeedbackList } from './FeedbackList';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import s from './feedback.module.css';

export const dynamic = 'force-dynamic';

/**
 * WHAT APRIL HAS BEEN TOLD (D93).
 *
 * Marrs asked for a way to give her feedback from any chat window. This is the other half, and
 * without it the feature is a write-only pile: notes accumulate, nobody can see what is in force,
 * and the prompts quietly fill up with things he said once nine weeks ago.
 *
 * THREE THINGS IT HAS TO ANSWER, and it is built around them rather than around the data:
 *
 * 1. WHAT IS IN FORCE RIGHT NOW, and where. A rule he cannot see is a rule he cannot trust, and the
 *    scope was guessed from context when the note was taken, so it has to be visible and changeable.
 * 2. WHAT IS NOT BEING APPLIED. The per-scope cap REFUSES rather than rotates (see feedback.ts), so
 *    anything over it is named here. A limit that silently drops things is a limit nobody can plan
 *    around.
 * 3. WHAT IS ACTUALLY A DEFECT. Two of his first three pieces of feedback were bugs rather than
 *    preferences, and a note cannot fix a bug: it leaves April told two opposite things. Marking one
 *    a defect takes it out of every prompt and puts it on a list to be fixed in code.
 *
 * Team scope only.
 */
export default async function FeedbackPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  let notes: FeedbackNote[] = [];
  try {
    notes = await listNotes();
  } catch (err) {
    console.error('[feedback] list failed:', err);
  }

  /**
   * WHICH NOTES ARE OVER THE CAP, worked out the same way the prompts work it out: by asking
   * `applyTo` for every scope that exists, so this screen and April can never disagree about what is
   * in force. A second implementation here is how those two drift apart.
   */
  const overflow = new Set<string>();
  const scopes: { stream?: string }[] = [{}, ...STREAMS.map((st) => ({ stream: st.id }))];
  for (const sc of scopes) {
    for (const job of [undefined, 'hooks', 'outline', 'script', 'copy', 'article', 'edit'] as const) {
      for (const n of applyTo(notes, { stream: sc.stream, job }).overflow) overflow.add(n.id);
    }
  }

  const live = notes.filter((n) => !n.retired_at && n.kind === 'rule');
  const defects = notes.filter((n) => !n.retired_at && n.kind === 'defect');
  const retired = notes.filter((n) => n.retired_at);

  return (
    <div className={s.root}>
      <header className={s.head}>
        <BackLink fallbackHref="/console/marketing" className={s.back} />
        <span className={s.eyebrow}>april · feedback</span>
        <h1 className={s.title}>What April has been told</h1>
        <p className={s.sub}>
          Type <code>feedback..</code> in any chat window and the note lands here, scoped to what she
          was doing. Every rule below goes into her brief on the next draft. Up to{' '}
          {NOTES_PER_SCOPE} per scope apply at once, so keep the list short and retire what has done
          its job.
        </p>
      </header>

      {notes.length === 0 ? (
        <p className={s.empty}>
          Nothing yet. Next time she gets something wrong, say{' '}
          <code>feedback.. don&rsquo;t do that, do this instead</code> in the chat beside the piece,
          and it will be in her brief from then on.
        </p>
      ) : (
        <FeedbackList
          live={live}
          defects={defects}
          retired={retired}
          overflow={[...overflow]}
          streams={STREAMS.map((st) => ({ id: st.id, label: streamLabel(st.id) }))}
        />
      )}
    </div>
  );
}
