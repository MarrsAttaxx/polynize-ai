/**
 * TEMPORARY diagnostic for the Soul generation "body.params: Field required" bug.
 * Runs a real Soul generation through the v1 client (which wraps { params }) using
 * the account's first Soul ID, and returns the raw JobSet jobs + the mapped result
 * so the fix can be confirmed before the user re-tests. No secrets returned.
 * DELETE after confirming.
 *
 * GET /api/diagnostics/soul-gen
 */

import { NextResponse } from 'next/server';
import { HiggsfieldClient } from '@higgsfield/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET() {
  const apiKey = process.env.HIGGSFIELD_API_KEY_ID;
  const apiSecret = process.env.HIGGSFIELD_API_KEY_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'higgsfield keys not configured' }, { status: 500 });
  }
  const client = new HiggsfieldClient({
    apiKey,
    apiSecret,
    maxPollTime: 200_000,
    pollInterval: 3_000,
  });

  let soulId: string | undefined;
  let soulName: string | undefined;
  try {
    const list = await client.listSoulIds(1, 20);
    const soul = list.items.find((s) => s.status === 'completed') ?? list.items[0];
    soulId = soul?.id;
    soulName = soul?.name;
  } catch (e) {
    return NextResponse.json(
      { step: 'listSoulIds', error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }

  const params: Record<string, unknown> = {
    prompt: 'a clean, natural-light studio portrait, sharp focus, neutral background',
    width_and_height: '1152x2048',
    quality: '1080p',
    batch_size: 1,
  };
  if (soulId) params.custom_reference_id = soulId;

  try {
    const jobSet = await client.generate('/v1/text2image/soul', params, {
      withPolling: true,
    });
    const urls = (jobSet.jobs ?? [])
      .map((j) => j.results?.raw?.url ?? j.results?.min?.url)
      .filter((u): u is string => Boolean(u));
    return NextResponse.json({
      soulId: soulId ?? null,
      soulName: soulName ?? null,
      jobSetId: jobSet.id,
      isCompleted: jobSet.isCompleted,
      isNsfw: jobSet.isNsfw,
      isFailed: jobSet.isFailed,
      urlCount: urls.length,
      firstUrl: urls[0] ?? null,
      // Raw jobs so the exact result shape is visible if extraction is off.
      jobs: jobSet.jobs,
    });
  } catch (e) {
    return NextResponse.json(
      {
        step: 'generate',
        soulId: soulId ?? null,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 502 }
    );
  }
}
