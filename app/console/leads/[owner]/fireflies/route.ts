/**
 * Fireflies meetings -> proposed contacts, and the accept.
 *
 *   GET                          the review list: external attendees not already in this CRM
 *   POST { accept: [emails] }    turn the ticked ones into contacts
 *
 * NOTHING IS WRITTEN BY THE GET. That is the whole point of the design: his Fireflies holds
 * personal meetings as well as sales calls, and no filter can reliably tell one from the
 * other, so a person ticks the ones that are real. See lib/crm/fireflies.ts.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { listContacts, upsertContact } from '@/lib/crm/contact-store';
import { getIgnored, ignoreEmails } from '@/lib/crm/ignored-store';
import {
  fetchRecentMeetings,
  isFirefliesConfigured,
  meetingsToCandidates,
  notesFor,
  type Candidate,
} from '@/lib/crm/fireflies';
import { STREAMS } from '@/lib/marketing/streams';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function guard(owner: string) {
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') return { error: 'unauthorized', status: 401 } as const;
  if (!STREAMS.some((s) => s.id === owner)) return { error: 'unknown stream', status: 400 } as const;
  return { user } as const;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ owner: string }> }
) {
  const { owner } = await params;
  const g = await guard(owner);
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });

  if (!isFirefliesConfigured()) {
    return NextResponse.json(
      { error: 'Fireflies is not connected yet (FIREFLIES_API_KEY is missing).' },
      { status: 400 }
    );
  }

  try {
    const [meetings, existing, ignored] = await Promise.all([
      fetchRecentMeetings({ limit: 25 }),
      listContacts(owner).catch(() => []),
      getIgnored(owner),
    ]);
    // Already a contact, or waved away once. Both mean "stop proposing this person", so they
    // go into the same exclusion set and the pure filter needs no knowledge of either.
    const candidates = meetingsToCandidates(meetings, {
      alreadyHave: new Set([...existing.map((c) => c.email.toLowerCase()), ...ignored]),
    });
    return NextResponse.json({ ok: true, scanned: meetings.length, candidates });
  } catch (err) {
    // The API's own message, surfaced. A wrong key and an empty account look identical
    // otherwise, and that is the error that wastes an afternoon.
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[crm.fireflies] fetch failed:', detail);
    return NextResponse.json({ error: detail.slice(0, 300) }, { status: 502 });
  }
}

const AcceptSchema = z.object({
  accept: z.array(z.string().trim().toLowerCase().email()).min(1).max(50),
});

const IgnoreSchema = z.object({
  ignore: z.array(z.string().trim().toLowerCase().email()).min(1).max(50),
});

/**
 * Stop proposing these people. A dismissal has to be remembered or it is not a dismissal:
 * the scan reads the same recent meetings each time, so anyone waved away would come back on
 * the next press and the list would never get shorter.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string }> }
) {
  const { owner } = await params;
  const g = await guard(owner);
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });

  let body: z.infer<typeof IgnoreSchema>;
  try {
    body = IgnoreSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Nothing was selected.' }, { status: 400 });
  }
  try {
    await ignoreEmails(owner, body.ignore);
  } catch (err) {
    console.error('[crm.fireflies] ignore failed:', err);
    return NextResponse.json({ error: 'Could not save that.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, ignored: body.ignore.length });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string }> }
) {
  const { owner } = await params;
  const g = await guard(owner);
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });

  let body: z.infer<typeof AcceptSchema>;
  try {
    body = AcceptSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Nothing was selected.' }, { status: 400 });
  }

  /**
   * The candidates are re-fetched rather than trusted from the client. The request only
   * carries which EMAILS were ticked, so the notes and the transcript link come from
   * Fireflies again instead of from whatever the browser sent.
   */
  let candidates: Candidate[] = [];
  try {
    const meetings = await fetchRecentMeetings({ limit: 25 });
    candidates = meetingsToCandidates(meetings, { alreadyHave: new Set() });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[crm.fireflies] re-fetch failed:', detail);
    return NextResponse.json({ error: detail.slice(0, 300) }, { status: 502 });
  }

  const wanted = new Set(body.accept);
  const chosen = candidates.filter((c) => wanted.has(c.email));
  if (chosen.length === 0) {
    return NextResponse.json(
      { error: 'Those meetings are no longer in the recent list. Reload and try again.' },
      { status: 409 }
    );
  }

  let added = 0;
  const failed: string[] = [];
  for (const c of chosen) {
    try {
      await upsertContact({
        owner,
        email: c.email,
        // No name: the real data has displayName null on every attendee, and guessing one
        // from the address is worse than leaving it blank for him to fill.
        stage: 'contacted',
        source: 'fireflies',
        notes: notesFor(c),
        fireflies_url: c.transcriptUrl,
      });
      added += 1;
    } catch (err) {
      console.error(`[crm.fireflies] could not add ${c.email}:`, err);
      failed.push(c.email);
    }
  }

  return NextResponse.json({ ok: true, added, failed });
}
