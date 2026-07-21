/**
 * TEMPORARY diagnostic for the Soul "Unavailable model" error. Lists Soul IDs +
 * statuses, then tries a real Soul generation four ways to pinpoint whether the
 * blocker is the base model, the Soul ID, or the request transport/shape:
 *   - v1_nosoul  : v1 client generate() (wraps {params}), no custom_reference_id
 *   - v1_soul    : v1 client generate() + a completed Soul ID
 *   - v2_params  : v2 subscribe() with input pre-wrapped as {params:{...}}
 *   - v2_flat    : v2 subscribe() with the flat input (expected to 422 on params)
 * Returns each result/error + the raw jobs shape. No secrets. DELETE after use.
 *
 * GET /api/diagnostics/soul-gen
 */

import { NextResponse } from 'next/server';
import { HiggsfieldClient } from '@higgsfield/client';
import { createHiggsfieldClient } from '@higgsfield/client/v2';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const ENDPOINT = '/v1/text2image/soul';
const BASE = {
  prompt: 'a clean, natural-light studio portrait, sharp focus, neutral background',
  width_and_height: '1152x2048',
  quality: '1080p',
  batch_size: 1,
};

export async function GET() {
  const apiKey = process.env.HIGGSFIELD_API_KEY_ID;
  const apiSecret = process.env.HIGGSFIELD_API_KEY_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'higgsfield keys not configured' }, { status: 500 });
  }
  const timing = { maxPollTime: 70_000, pollInterval: 3_000 };
  const v1 = new HiggsfieldClient({ apiKey, apiSecret, ...timing });
  const v2 = createHiggsfieldClient({ apiKey, apiSecret, ...timing });

  const out: Record<string, unknown> = {};

  let completedSoulId: string | undefined;
  try {
    const list = await v1.listSoulIds(1, 20);
    out.souls = list.items.map((s) => ({ id: s.id, name: s.name, status: s.status }));
    completedSoulId = list.items.find((s) => s.status === 'completed')?.id;
    out.completedSoulId = completedSoulId ?? null;
  } catch (e) {
    out.souls_error = e instanceof Error ? e.message : String(e);
  }

  const tryV1 = async (params: Record<string, unknown>) => {
    try {
      const js = await v1.generate(ENDPOINT, params, { withPolling: true });
      const urls = (js.jobs ?? [])
        .map((j) => j.results?.raw?.url ?? j.results?.min?.url)
        .filter((u): u is string => Boolean(u));
      return {
        ok: true,
        completed: js.isCompleted,
        nsfw: js.isNsfw,
        failed: js.isFailed,
        urlCount: urls.length,
        firstUrl: urls[0] ?? null,
        jobsSample: js.jobs?.slice(0, 1),
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  const tryV2 = async (input: Record<string, unknown>) => {
    try {
      const r = await v2.subscribe(ENDPOINT, { input, withPolling: true });
      return {
        ok: true,
        status: r.status,
        request_id: r.request_id,
        urlCount: (r.images ?? []).length,
        firstUrl: r.images?.[0]?.url ?? null,
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  out.v1_nosoul = await tryV1({ ...BASE });
  out.v1_soul = completedSoulId
    ? await tryV1({ ...BASE, custom_reference_id: completedSoulId })
    : 'skipped (no completed soul id)';
  out.v2_params = await tryV2({ params: { ...BASE } });
  out.v2_flat = await tryV2({ ...BASE });

  return NextResponse.json(out);
}
