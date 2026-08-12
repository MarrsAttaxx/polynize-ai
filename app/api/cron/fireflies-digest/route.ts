/**
 * The daily "somebody new to review" check.
 *
 * Runs on a Vercel cron (see vercel.json). Reads recent Fireflies meetings, works out who is
 * new across all five CRMs, and emails the Polynize notify list if there is anybody. It never
 * writes a contact: that stays a human decision, because his Fireflies holds personal
 * meetings and no filter can reliably tell one from a sales call.
 *
 * AUTH. Vercel sends `Authorization: Bearer $CRON_SECRET` when that variable is set. This
 * route REFUSES to run when CRON_SECRET is missing rather than defaulting to open, because
 * the alternative is a publicly triggerable endpoint that reads meeting data and sends mail.
 * The comparison is constant-time so the secret cannot be probed a character at a time.
 */

import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { runDigest } from '@/lib/crm/fireflies-digest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Five streams, each doing a couple of store reads, plus one Fireflies call and a few sends.
export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) {
    // Deliberately says nothing about whether the secret is missing or merely wrong.
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await runDigest();
  // Logged as well as returned, because nobody reads a cron's response body: this line is how
  // a silent day is distinguished from a broken one.
  console.log(
    `[cron.fireflies-digest] fresh=${result.freshCount} sent=${result.sent}${
      result.skipped ? ` skipped=${result.skipped}` : ''
    }`
  );
  return NextResponse.json({ ok: true, ...result, groups: result.groups.map((g) => ({ owner: g.owner, fresh: g.fresh.length, total: g.total })) });
}
