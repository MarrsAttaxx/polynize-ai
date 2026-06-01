import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import {
  authorizeClientAccess,
  requireConsoleAuth,
  requireTeamScope,
} from '@/lib/console-api-auth';

export const dynamic = 'force-dynamic';

const RefreshSchema = z
  .object({
    paths: z.array(z.string()).optional(),
  })
  .optional();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireConsoleAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const teamGate = requireTeamScope(auth);
  if (!teamGate.ok) {
    return NextResponse.json(
      { error: teamGate.error },
      { status: teamGate.status }
    );
  }

  const { slug } = await params;
  if (!isValidConsoleSlug(slug)) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }
  if (!authorizeClientAccess(auth.scope, slug)) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // Body is optional. The `paths` field is currently advisory only —
  // we always invalidate the full Blueprint surface for the slug.
  try {
    const raw = await request.json();
    RefreshSchema.safeParse(raw);
  } catch {
    // empty body fine
  }

  const invalidated = [
    `/console/${slug}/blueprint`,
    `/api/console/${slug}/blueprint`,
    '/console',
    '/api/console/clients',
  ];
  for (const path of invalidated) {
    revalidatePath(path);
  }

  return NextResponse.json({ ok: true, invalidated });
}
