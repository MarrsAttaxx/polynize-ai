import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId, streamLabel } from '@/lib/marketing/streams';
import { getBrandVoiceForStream } from '@/lib/marketing/brand-voice-store';
import { BrandVoiceEditor } from './BrandVoiceEditor';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import s from './brand-voice.module.css';

export const dynamic = 'force-dynamic';

/**
 * A stream's brand-voice doc (D20) — the register every piece in this stream is
 * written in (concept synthesis, the interview, post authoring all read it).
 * Editable here; created from Marrs's brand-voice builder prompt for now (the
 * in-console April interview flow is deferred until a second creator onboards).
 * Team-scope only.
 */
export default async function BrandVoicePage({
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

  let initial = '';
  try {
    initial = (await getBrandVoiceForStream(stream)) ?? '';
  } catch (err) {
    console.error('[brand-voice] read failed:', err);
  }

  return (
    <div className={s.root}>
      <header className={s.head}>
        <BackLink fallbackHref={`/console/marketing/stream/${stream}`} className={s.back} />
        <span className={s.eyebrow}>brand voice · {streamLabel(stream)}</span>
        <h1 className={s.title}>Brand voice</h1>
        <p className={s.sub}>
          The register every piece in this stream is written in. April reads it when
          she interviews, synthesises the concept, and drafts posts. Paste or edit the
          voice doc below.
        </p>
      </header>
      <BrandVoiceEditor initial={initial} />
    </div>
  );
}
