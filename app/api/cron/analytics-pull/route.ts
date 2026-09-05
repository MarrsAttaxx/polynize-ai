/**
 * THE NIGHTLY PULL (D98, step 3 of the plan). The same work as pressing Pull now on the engine
 * page: five brands from Metricool, then the url join, then the site's numbers from Vercel.
 *
 * AUTH exactly as the Fireflies digest: Vercel sends `Authorization: Bearer $CRON_SECRET`, the
 * route refuses to run without it, constant-time compare. Runs at 17:10 UTC, which is 3:10am in
 * Sydney, after every platform has had a day to report.
 *
 * It writes only our own caches. Running it twice is two identical files.
 */

import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { STREAMS } from '@/lib/marketing/streams';
import { pullStream } from '@/lib/marketing/analytics-pull';
import { pullSite } from '@/lib/marketing/site-analytics-pull';
import { joinPublishedUrls } from '@/lib/marketing/url-join';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** Five brand reads, one scheduler read per brand, eighteen Vercel calls in three rounds. */
export const maxDuration = 300;

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
  if (!authorised(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const brands = [];
  for (const s of STREAMS) brands.push(await pullStream(s.id));
  const join = await joinPublishedUrls();
  const site = await pullSite();

  const posts = brands.filter((b) => b.ok).reduce((n, b) => n + b.posts, 0);
  console.log(
    `[cron.analytics-pull] posts=${posts} brands_ok=${brands.filter((b) => b.ok).length}/${brands.length} urls_joined=${join.joined}/${join.checked} site_windows=${site.windows}${site.error ? ` site_error="${site.error}"` : ''}${join.errors.length ? ` join_errors=${join.errors.length}` : ''}`
  );
  return NextResponse.json({ ok: true, posts, brands, join, site });
}
