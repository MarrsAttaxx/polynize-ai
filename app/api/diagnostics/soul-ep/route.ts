/**
 * TEMPORARY probe to lock the real Higgsfield Soul generation endpoint + body.
 * The account's API reference shows the generation endpoints were renamed from
 * /v1/text2image/soul to /higgsfield-ai/soul/standard (and /soul/v2/standard,
 * /soul/character), polled via /requests/{id}/status (v2 flow). This tries the
 * new endpoints via v2 subscribe with and without the {params} wrapper to find
 * the working combo. No secrets returned. DELETE after wiring.
 *
 * GET /api/diagnostics/soul-ep
 */

import { NextResponse } from 'next/server';
import { HiggsfieldClient } from '@higgsfield/client';
import { createHiggsfieldClient } from '@higgsfield/client/v2';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

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
    return NextResponse.json({ error: 'keys not configured' }, { status: 500 });
  }
  const timing = { maxPollTime: 70_000, pollInterval: 3_000 };
  const v2 = createHiggsfieldClient({ apiKey, apiSecret, ...timing });
  const v1 = new HiggsfieldClient({ apiKey, apiSecret, ...timing });

  const out: Record<string, unknown> = {};
  let soulId: string | undefined;
  try {
    const list = await v1.listSoulIds(1, 20);
    soulId = list.items.find((s) => s.status === 'completed')?.id;
    out.soulId = soulId ?? null;
  } catch (e) {
    out.souls_error = e instanceof Error ? e.message : String(e);
  }

  const tryV2 = async (endpoint: string, input: Record<string, unknown>) => {
    try {
      const r = await v2.subscribe(endpoint, { input, withPolling: true });
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

  out.standard_params = await tryV2('/higgsfield-ai/soul/standard', { params: { ...BASE } });
  out.standard_flat = await tryV2('/higgsfield-ai/soul/standard', { ...BASE });
  out.standard_min = await tryV2('/higgsfield-ai/soul/standard', { params: { prompt: BASE.prompt } });
  out.standard_params_soul = soulId
    ? await tryV2('/higgsfield-ai/soul/standard', { params: { ...BASE, custom_reference_id: soulId } })
    : 'no completed soul id';
  out.v2_standard_params = await tryV2('/higgsfield-ai/soul/v2/standard', { params: { ...BASE } });

  return NextResponse.json(out);
}
