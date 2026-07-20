import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId, streamLabel } from '@/lib/marketing/streams';
import { listTemplates, type ContentTemplate } from '@/lib/marketing/template-store';
import { LIBRARY_TEMPLATES } from '@/lib/marketing/template-library';
import { TemplatesManager } from './TemplatesManager';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import s from './templates.module.css';

export const dynamic = 'force-dynamic';

/**
 * A stream's Content Pillar Template library (D25) — the recipes this stream's
 * content is made from, refined over time: keep what works, retire what flops.
 * Create/edit templates here, or copy one in from the built-in library. Sits
 * alongside the brand-voice doc as a stream-home core asset. Team-scope only.
 */
export default async function TemplatesPage({
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

  let templates: ContentTemplate[] = [];
  try {
    templates = await listTemplates(stream);
  } catch (err) {
    console.error('[templates] list failed:', err);
  }

  return (
    <div className={s.root}>
      <header className={s.head}>
        <BackLink fallbackHref={`/console/marketing/stream/${stream}`} className={s.back} />
        <span className={s.eyebrow}>content templates · {streamLabel(stream)}</span>
        <h1 className={s.title}>Content templates</h1>
        <p className={s.sub}>
          A content template is a repeatable recipe for a run of posts: what you bring, what
          you get, and how it is made, plus the platforms and audience it serves. Refine
          them over time; keep the ones that work, retire the ones that flop.
        </p>
      </header>
      <TemplatesManager
        stream={stream}
        initial={templates}
        library={LIBRARY_TEMPLATES}
      />
    </div>
  );
}
