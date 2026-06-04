/**
 * Statement of Works page — /console/[slug]/sow.
 *
 * Renders the in-Console, editable SoW generated from the engagement's
 * Blueprint. Team users can generate / regenerate and edit every field;
 * client-scope viewers (if they reach it) see a read-only document. The
 * "delete this page" instructional pages from the source templates are not
 * reproduced.
 *
 * No PDF export and no readiness gate in this build (manual export for now).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import YAML from 'yaml';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import { readClientFile } from '@/lib/github-client';
import { getCurrentUser, userHasClientAccess } from '@/lib/console-auth';
import { readSowDoc } from '@/lib/sow/sow-io';
import { SowDocument } from './_components/SowDocument';
import { SowGenerateButton } from './_components/SowGenerateButton';
import { SowPrintButton } from './_components/SowPrintButton';
import s from './sow.module.css';

export const dynamic = 'force-dynamic';

async function loadClientName(slug: string): Promise<string | null> {
  try {
    const raw = await readClientFile(slug, '.polynize/client-config.yaml');
    const cfg = (YAML.parse(raw) ?? {}) as { client?: { name?: string } };
    return cfg?.client?.name ?? slug;
  } catch {
    return null; // not an engagement repo
  }
}

export default async function SowPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isValidConsoleSlug(slug)) notFound();

  const user = await getCurrentUser();
  if (user && !userHasClientAccess(user, slug)) notFound();

  const clientName = await loadClientName(slug);
  if (clientName === null) notFound();

  const isTeamUser = user?.scope.type === 'team';
  const doc = await readSowDoc(slug);

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.page}>
        <header className={s.pageHeader}>
          <div className={s.eyebrow}>
            POLYNIZE AGENTIC MANAGEMENT CONSOLE · STATEMENT OF WORKS
          </div>
          <h1 className={s.pageTitle}>{clientName}</h1>
          <div className={s.headerActions}>
            <Link href={`/console/${slug}/blueprint`} className={s.backLink}>
              ← Blueprint
            </Link>
            {doc && <SowPrintButton />}
            {isTeamUser && <SowGenerateButton slug={slug} exists={!!doc} />}
          </div>
        </header>

        {doc ? (
          <SowDocument doc={doc} slug={slug} canEdit={isTeamUser} />
        ) : (
          <div className={s.empty}>
            <p className={s.emptyLead}>
              No Statement of Works has been generated for this engagement yet.
            </p>
            <p className={s.muted}>
              {isTeamUser
                ? 'Generate one from the Blueprint with the button above. Blueprint-derived fields auto-fill; commercial and legal fields show as NEEDS INPUT for the team to complete. The Service Agreement is included as Annexure A.'
                : 'It will appear here once the Polynize team generates it.'}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
