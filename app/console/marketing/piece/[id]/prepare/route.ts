/**
 * POST /console/marketing/piece/[id]/prepare — turn an approved post into
 * per-channel calendar entries (D23/D24, publishing Step 1).
 *
 * For each channel the piece targets, April adapts the approved base copy to that
 * platform's register (in one call), and we create/refresh one calendar entry per
 * channel (status 'draft', unscheduled). The calendar then shows what's coming and
 * lets the owner set dates; actual scheduling to Metricool is a later step.
 *
 * Idempotent per (piece, channel): re-preparing refreshes the copy but preserves
 * any date/status already set. Team-scope only; owner + piece from the session/route.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece } from '@/lib/marketing/piece-store';
import { getBrandVoiceForStream } from '@/lib/marketing/brand-voice-store';
import { channelLabel } from '@/lib/marketing/channels';
import {
  listEntriesForPiece,
  saveEntry,
  type CalendarEntry,
} from '@/lib/marketing/calendar-store';
import { complete } from '@/lib/llm';
import { stripEmDashes } from '@/lib/em-dash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function systemPrompt(channels: string[], brandVoice?: string): string {
  const list = channels.map((c) => `- ${c}: ${channelLabel(c)}`).join('\n');
  const voice = brandVoice
    ? `\n\nWrite in this brand voice. Match its register, phrasing, and point of view:\n"""\n${brandVoice}\n"""`
    : '';
  return `You are April, Polynize's copy and voice specialist. You are given one approved post and must adapt it for each of these platforms:
${list}

Adapt for each platform's norms while keeping the SAME core message and facts:
- LinkedIn: professional, a little longer, line breaks between thoughts, no hashtags unless natural.
- Instagram / TikTok: punchier, first line is a strong hook, a few relevant hashtags at the end are fine.
- X: tight, one sharp idea, under ~280 characters.
- Substack / Newsletter: a warmer, slightly longer lead-in is fine.
${voice}

Polynize voice:
- Direct, contrarian, concrete. No hype, no filler, no corporate throat-clearing.
- Never use em-dashes. Use commas, periods, or colons instead.

Return ONLY a JSON object whose keys are the exact platform ids above and whose values are the adapted post text for that platform. No commentary, no markdown, no code fences. Example shape: {"linkedin": "...", "x": "..."}`;
}

function parseJsonLoose(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fence ? fence[1] : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object');
  const obj = JSON.parse(candidate.slice(start, end + 1));
  return obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : {};
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const owner = user.email;

  let piece;
  try {
    piece = await getPiece(owner, id);
  } catch (err) {
    console.error('[prepare] piece read failed:', err);
    return NextResponse.json({ error: 'could not read the piece' }, { status: 502 });
  }
  if (!piece) {
    return NextResponse.json({ error: 'piece not found' }, { status: 404 });
  }

  const base = (piece.body ?? '').trim();
  if (!base) {
    return NextResponse.json(
      { error: 'draft and approve the post before preparing it for channels' },
      { status: 400 }
    );
  }
  const channels = (piece.platforms ?? []).filter(Boolean);
  if (channels.length === 0) {
    return NextResponse.json(
      { error: 'no channels selected for this piece. Re-plan it with at least one platform.' },
      { status: 400 }
    );
  }

  const brandVoice = await getBrandVoiceForStream(piece.stream);

  let variants: Record<string, string> = {};
  try {
    const raw = await complete({
      system: systemPrompt(channels, brandVoice),
      messages: [{ role: 'user', content: `APPROVED POST:\n"""\n${base}\n"""\n\nAdapt it for each platform and return the JSON object.` }],
      maxTokens: 3000,
      temperature: 0.6,
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
    const parsed = parseJsonLoose(raw);
    for (const c of channels) {
      const v = parsed[c];
      variants[c] = typeof v === 'string' && v.trim() ? stripEmDashes(v.trim()) : base;
    }
  } catch (e) {
    // If the model call or parse fails, fall back to the base copy on every
    // channel so the calendar still gets its entries (the human can edit each).
    console.error(`[prepare] per-platform copy failed, using base: ${e instanceof Error ? e.message : String(e)}`);
    variants = Object.fromEntries(channels.map((c) => [c, base]));
  }

  try {
    const existing = await listEntriesForPiece(owner, id);
    const now = new Date().toISOString();
    const entries: CalendarEntry[] = [];
    for (const channel of channels) {
      const prior = existing.find((e) => e.channel === channel);
      const entry: CalendarEntry = prior
        ? { ...prior, title: piece.title, post_copy: variants[channel], updated_at: now }
        : {
            entry_id: crypto.randomUUID(),
            owner,
            stream: piece.stream,
            piece_id: id,
            title: piece.title,
            channel,
            post_copy: variants[channel],
            status: 'draft',
            created_at: now,
            updated_at: now,
          };
      await saveEntry(owner, entry);
      entries.push(entry);
    }
    return NextResponse.json({ count: entries.length });
  } catch (err) {
    console.error('[prepare] entry write failed:', err);
    return NextResponse.json({ error: 'could not create the calendar entries' }, { status: 500 });
  }
}
