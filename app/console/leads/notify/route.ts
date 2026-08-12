/**
 * Who gets pinged when a lead lands in one CRM.
 *
 *   POST { owner, recipients }   recipients is free text: commas, newlines or semicolons
 *
 * Free text and not a repeating field, because this is edited rarely and pasting a couple
 * of addresses is the whole interaction. The store parses and de-duplicates.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getNotifyMap, parseRecipients, saveNotifyMap } from '@/lib/crm/notify-store';
import { STREAMS } from '@/lib/marketing/streams';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Schema = z.object({
  owner: z.enum(STREAMS.map((s) => s.id) as [string, ...string[]]),
  recipients: z.string().max(2000),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const list = parseRecipients(body.recipients);

  try {
    /**
     * READ, MERGE, WRITE. The map holds every stream in one object, so writing only this
     * stream's key would erase the other four. Read first, replace one key, write back.
     */
    const map = await getNotifyMap();
    if (list.length === 0) delete map[body.owner];
    else map[body.owner] = list;
    await saveNotifyMap(map);
    return NextResponse.json({ ok: true, recipients: list });
  } catch (err) {
    console.error('[crm.notify] save failed:', err);
    return NextResponse.json({ error: 'Could not save that.' }, { status: 502 });
  }
}
