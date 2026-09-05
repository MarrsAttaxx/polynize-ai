import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { readAttribution } from '@/lib/marketing/tracking-link';
import { setAttributionCookie } from '@/lib/attribution-cookie';

export const runtime = 'nodejs';

/**
 * POST /api/attribution: the page reports how the visitor arrived, the server decides what to keep.
 *
 * Body: { search: '?utm_source=...', referrer?: string, landing?: string }. Everything is run
 * through readAttribution, which allowlists keys and drops any value that is not a plain token,
 * so a crafted url cannot put a sentence or an address into the cookie or, later, the lead.
 *
 * Nothing to attribute (no utm labels) is a 200 with stored:false, not an error: a plain visit is
 * the common case and must cost nothing.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    search?: unknown;
    referrer?: unknown;
    landing?: unknown;
  } | null;
  const search = typeof body?.search === 'string' ? body.search.slice(0, 2000) : '';
  const attr = readAttribution(search, {
    referrer: typeof body?.referrer === 'string' ? body.referrer.slice(0, 500) : undefined,
    landing: typeof body?.landing === 'string' ? body.landing.slice(0, 500) : undefined,
  });
  if (!attr) return NextResponse.json({ stored: false });
  const { first } = await setAttributionCookie(attr);
  return NextResponse.json({ stored: true, first });
}
