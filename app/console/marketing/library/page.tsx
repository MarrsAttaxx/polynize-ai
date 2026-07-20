import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { listConcepts, type ConceptDoc } from '@/lib/marketing/concept-store';
import { isStreamId, streamLabel, DEFAULT_STREAM, STREAMS, type StreamId } from '@/lib/marketing/streams';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import { CopyConceptButton } from './CopyConceptButton';
import s from './library.module.css';

export const dynamic = 'force-dynamic';

/**
 * The Concept Library: browse every other brand stream's core concepts and copy
 * any of them into YOUR stream (a copy, not a move — the source stream keeps
 * its own). `?stream=` is the import target (the stream you came from).
 * Team-scope only.
 */
export default async function ConceptLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ stream?: string }>;
}) {
  const { stream } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }
  const target: StreamId = isStreamId(stream) ? stream : DEFAULT_STREAM;

  let concepts: ConceptDoc[] = [];
  try {
    concepts = await listConcepts(user.email);
  } catch (err) {
    console.error('[library] concept list failed:', err);
  }

  // Group the OTHER streams' concepts by stream, in dashboard order.
  const byStream = new Map<string, ConceptDoc[]>();
  for (const c of concepts) {
    const st = c.stream || DEFAULT_STREAM;
    if (st === target) continue;
    if (!byStream.has(st)) byStream.set(st, []);
    byStream.get(st)!.push(c);
  }
  const sections = STREAMS.filter((st) => byStream.has(st.id));
  const total = [...byStream.values()].reduce((n, arr) => n + arr.length, 0);

  return (
    <div className={s.root}>
      <header className={s.head}>
        <BackLink
          fallbackHref={`/console/marketing/stream/${target}`}
          className={s.back}
          dashboardHref={`/console/marketing/stream/${target}`}
        />
        <span className={s.eyebrow}>concept library · importing into {streamLabel(target)}</span>
        <h1 className={s.title}>Concept library</h1>
        <p className={s.sub}>
          Core concepts from the other brand streams. Copy any of them into{' '}
          {streamLabel(target)} to develop in its voice; the original stays where it is.
        </p>
      </header>

      {total === 0 ? (
        <p className={s.empty}>No concepts in the other streams yet.</p>
      ) : (
        sections.map((st) => (
          <section key={st.id} className={s.panel}>
            <h2 className={s.panelTitle}>{st.label}</h2>
            <ul className={s.list}>
              {byStream.get(st.id)!.map((c) => (
                <li key={c.concept_ref} className={s.row}>
                  <div className={s.rowMain}>
                    <Link
                      href={`/console/marketing/concept/${c.framing_slug}`}
                      className={s.rowTitle}
                    >
                      {c.title}
                    </Link>
                    <span className={s.rowMeta}>{streamLabel(st.id)}</span>
                  </div>
                  <CopyConceptButton
                    slug={c.framing_slug}
                    targetStream={target}
                    targetLabel={streamLabel(target)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
