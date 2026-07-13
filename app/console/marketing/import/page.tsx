import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId, STREAMS, DEFAULT_STREAM, type StreamId } from '@/lib/marketing/streams';
import { ImportForm } from './ImportForm';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import s from './import.module.css';

export const dynamic = 'force-dynamic';

/**
 * Import a concept (D25): paste a concept doc (e.g. one extracted from a meeting
 * in an isolated Claude session) and it lands in the concept bank exactly like an
 * April-interviewed concept — same store, same downstream flow. Team-scope only.
 */
export default async function ImportConceptPage({
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

  const initialStream: StreamId = isStreamId(stream) ? stream : DEFAULT_STREAM;

  return (
    <div className={s.root}>
      <header className={s.head}>
        <BackLink fallbackHref="/console/marketing" className={s.back} />
        <span className={s.eyebrow}>import a concept</span>
        <h1 className={s.title}>Import a concept</h1>
        <p className={s.sub}>
          Paste a concept document (Markdown works best). It joins the concept bank like
          any other concept: you can create content from it, and April reads it when
          drafting.
        </p>
      </header>
      <ImportForm streams={[...STREAMS]} initialStream={initialStream} />
    </div>
  );
}
