import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DraftingGrid } from '../../_components/DraftingGrid';
import { SiteFooter } from '../../_components/SiteFooter';
import { supabaseService } from '@/lib/supabase';
import { validateJobBlueprint } from '@/lib/agents/job-blueprint-schema';
import { JobBlueprintDoc } from '../JobBlueprintDoc';
import s from '../job-mapping.module.css';

/**
 * /job-mapping/<id>
 *
 * Where the email link lands, and where a shared link resolves. Server-rendered from the
 * row rather than fetched on the client, so the page is readable immediately and so a
 * pending or failed blueprint can say so honestly instead of showing an empty document.
 *
 * NOINDEX. The route is indexed; individual blueprints are not. They are somebody's job,
 * arrived at through a link only they were sent.
 */
export const metadata: Metadata = {
  title: 'Your job map',
  robots: { index: false, follow: false },
};

type Row = { status: string; content: unknown; role_title: string | null; error: string | null };

async function load(id: string): Promise<Row | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const sb = supabaseService();
  const { data } = await sb
    .from('job_blueprints')
    .select('status, content, role_title, error')
    .eq('id', id)
    .maybeSingle();
  return (data as Row) ?? null;
}

export default async function JobBlueprintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await load(id);
  if (!row) notFound();

  const validation = row.status === 'ready' ? validateJobBlueprint(row.content) : null;

  return (
    <>
      <DraftingGrid />
      <main className={s.page}>
        {validation?.ok ? (
          <JobBlueprintDoc blueprint={validation.data} />
        ) : (
          <div className={s.stateCard}>
            <div className={s.eyebrow}>Your job map</div>
            <h1 className={s.stateTitle}>
              {row.status === 'pending' ? 'Still working on it.' : 'That one did not come through.'}
            </h1>
            <p className={s.stateBody}>
              {row.status === 'pending'
                ? 'This page updates when it is done. Give it a minute and refresh, or wait for the email.'
                : 'Something went wrong while mapping the role. Nothing was kept, so pasting it again is the fastest way through.'}
            </p>
            <Link className={s.stateBtn} href="/job-mapping">
              Map a job description <span aria-hidden>→</span>
            </Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
