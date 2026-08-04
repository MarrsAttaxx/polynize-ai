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
        <BackLink
          fallbackHref={`/console/marketing/stream/${stream}`}
          className={s.back}
          dashboardHref={`/console/marketing/stream/${stream}`}
        />
        <span className={s.eyebrow}>content templates · {streamLabel(stream)}</span>
        <h1 className={s.title}>Content templates</h1>
        <p className={s.sub}>
          A template is the SHAPE a piece takes, reused across many pieces. It is not what
          the piece is about (that is the concept) and not the argument it makes (that is the
          angle you give when you create the piece). Keep the ones that work, retire the
          ones that flop.
        </p>
        <details className={s.guide}>
          <summary className={s.guideSummary}>How to write one that behaves</summary>
          <div className={s.guideBody}>
            <p>
              <strong>Write instructions, not descriptions.</strong> &ldquo;Line 1: state
              the belief the reader already holds, as if you agree. Line 2: flip it in under
              12 words.&rdquo; is followed. &ldquo;A punchy contrarian opening&rdquo; is not,
              because there is nothing in it to do.
            </p>
            <p>
              <strong>One instruction per line.</strong> The three recipe fields are injected
              into the prompt as separate named sections, so a rule buried mid-paragraph
              carries less weight than one on its own line.
            </p>
            <p>
              <strong>Structure goes in the fields, never in the prose.</strong> Asking for
              three hooks by writing &ldquo;hook&rdquo; three times in the recipe does not
              work: the number of hooks is set by <em>How many hooks?</em> above, and that is
              what changes the shape of the draft.
            </p>
            <p>
              <strong>Say what NOT to do.</strong> A single &ldquo;never summarise at the
              end&rdquo; removes more bad drafts than three more lines about what you want.
            </p>
            <p>
              <strong>Leave the words to the angle.</strong> A template that names specific
              phrases makes every piece off it sound the same. Specific copy belongs in the
              angle, where it is used verbatim for that one piece.
            </p>
            <p>
              <strong>A built-in becomes yours the moment you use it.</strong> Using a library
              template copies it into this stream, so you can edit it here and the next piece
              picks up your version.
            </p>
          </div>
        </details>
      </header>
      <TemplatesManager
        stream={stream}
        initial={templates}
        library={LIBRARY_TEMPLATES}
      />
    </div>
  );
}
