/**
 * GET /api/diagnostics/higgsfield — ONE-OFF diagnostic to verify the Higgsfield
 * integration in prod (the keys live in Vercel, not locally). Reports whether the
 * keys are present and whether an authenticated call succeeds. Leaks no secrets;
 * makes only cheap catalogue GETs (no image credits). DELETE this route once the
 * integration is confirmed.
 */

import { NextResponse } from 'next/server';
import {
  isHiggsfieldConfigured,
  getSoulStyleList,
  listSoulIdentities,
} from '@/lib/marketing/higgsfield';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const configured = isHiggsfieldConfigured();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      note: 'HIGGSFIELD_API_KEY_ID / HIGGSFIELD_API_KEY_SECRET are not set in this environment.',
    });
  }

  let authOk = false;
  let soulStyleCount = 0;
  let soulIdCount = 0;
  let error: string | null = null;
  try {
    const styles = await getSoulStyleList();
    soulStyleCount = Array.isArray(styles) ? styles.length : 0;
    authOk = true;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  try {
    soulIdCount = (await listSoulIdentities()).length;
  } catch {
    // non-fatal for the auth check
  }

  return NextResponse.json({
    configured: true,
    authOk,
    soulStyleCount,
    soulIdCount,
    error,
    note: 'One-off diagnostic. Delete app/api/diagnostics/higgsfield/route.ts after verifying.',
  });
}
