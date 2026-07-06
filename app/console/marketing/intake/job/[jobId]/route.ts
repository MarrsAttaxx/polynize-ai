/**
 * GET /console/marketing/intake/job/[jobId] — poll a job's status.
 *
 * Team-scope only; owner from the session, so a job id alone can't read another
 * owner's job. Returns { status, conceptSlug?, error? }. On done, the output_ref
 * is the concept doc key; we hand back the framing slug so the client can route
 * to the concept view.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getAgentProvider } from '@/lib/agents/socket';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Extract the framing slug from a concept key `pam/concept-bank/{owner}/core-concept-{slug}.md`. */
function slugFromRef(ref: string | undefined): string | null {
  if (!ref) return null;
  const m = ref.match(/core-concept-(.+)\.md$/);
  return m ? m[1] : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const provider = await getAgentProvider();
    const view = await provider.jobStatus(user.email, jobId);
    return NextResponse.json(
      {
        status: view.status,
        conceptSlug: slugFromRef(view.outputRef),
        error: view.error ?? null,
      },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[intake.job] status threw: ${msg}`);
    return NextResponse.json({ error: 'status read failed' }, { status: 500 });
  }
}
