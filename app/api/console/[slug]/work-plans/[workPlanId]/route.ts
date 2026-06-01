/**
 * GET /api/console/[slug]/work-plans/[workPlanId] — one work plan with
 * full sprint detail + its progress log. Read endpoint. Spec §8.2.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import { readClientFile } from '@/lib/github-client';
import {
  authorizeClientAccess,
  requireConsoleAuth,
} from '@/lib/console-api-auth';
import { loadWorkPlanForWrite } from '@/lib/blueprint/work-plan-io';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; workPlanId: string }> }
) {
  const auth = await requireConsoleAuth(request);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { slug, workPlanId } = await params;
  if (!isValidConsoleSlug(slug))
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  if (!authorizeClientAccess(auth.scope, slug))
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const loaded = await loadWorkPlanForWrite(slug, workPlanId);
  if (!loaded.ok)
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });

  let progressLog = '';
  try {
    progressLog = await readClientFile(
      slug,
      `work-plans/${workPlanId}/progress.md`
    );
  } catch {
    progressLog = '';
  }

  return NextResponse.json({ slug, plan: loaded.plan, progressLog });
}
