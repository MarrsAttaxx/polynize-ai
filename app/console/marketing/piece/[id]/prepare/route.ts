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
import { getChannelSchedule, NETWORKS, type Network } from '@/lib/marketing/channel-schedule';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * IT MAKES AN LLM CALL AND HAD NO BUDGET (D80). Every other model route under marketing sets one
 * (the wave 300, the intake 300, a draft 60) and this one relied on the platform default, so a slow
 * adaptation was killed mid-flight and left the piece with no entries and no explanation.
 */
export const maxDuration = 60;

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
  req: NextRequest,
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

  /**
   * ADAPT, OR SEND WHAT HE WROTE (D80).
   *
   * Adapting per platform is right when the copy came from an article and has to reach four feeds
   * with different registers. It is wrong when the operator wrote the caption himself for one
   * finished video: April rewriting his words is not an improvement he asked for, and until now
   * there was no way to decline it, because this route never read its request body at all.
   *
   * The default is unchanged, so every existing caller behaves exactly as before.
   */
  const reqBody = (await req.json().catch(() => null)) as { adapt?: unknown } | null;
  const adapt = reqBody?.adapt !== false;

  /**
   * HOW EACH ENTRY REACHES ITS PLATFORM, stamped here for the first time (D41, extended D80).
   *
   * The wave has always stamped this and nothing else did, so a post prepared from a piece arrived
   * on the calendar with no mode at all. That mattered most in the one place he was specific about:
   * his own LinkedIn is hand-posted because scheduling it restricts reach, and an unstamped entry is
   * treated as auto.
   */
  const modes = await getChannelSchedule(piece.stream)
    .then((sched) => sched.modes)
    .catch((err) => {
      console.error('[prepare] channel schedule read failed, treating every channel as auto:', err);
      return null;
    });
  const modeFor = (channel: string): 'auto' | 'manual' =>
    modes && (NETWORKS as readonly string[]).includes(channel)
      ? (modes[channel as Network] ?? 'auto')
      : 'auto';

  const brandVoice = adapt ? await getBrandVoiceForStream(piece.stream) : undefined;

  let variants: Record<string, string> = {};
  if (!adapt) {
    variants = Object.fromEntries(channels.map((c) => [c, stripEmDashes(base)]));
  } else try {
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
    //
    // STRIPPED HERE TOO (D80). The em-dash rule was applied to April's output only, so the one path
    // where the copy is a human's own words was the one path that could ship an em dash. It rarely
    // showed while every draft was model written; a caption typed for a finished video makes it the
    // normal case.
    console.error(`[prepare] per-platform copy failed, using base: ${e instanceof Error ? e.message : String(e)}`);
    variants = Object.fromEntries(channels.map((c) => [c, stripEmDashes(base)]));
  }

  try {
    const existing = await listEntriesForPiece(owner, id);
    const now = new Date().toISOString();
    const entries: CalendarEntry[] = [];
    for (const channel of channels) {
      const prior = existing.find((e) => e.channel === channel);
      const entry: CalendarEntry = prior
        ? {
            ...prior,
            title: piece.title,
            post_copy: variants[channel],
            media: piece.media ?? [],
            // Re-stamped, because the lane's mode may have changed since it was first prepared.
            publish_mode: modeFor(channel),
            youtube_type: piece.youtube_type,
            updated_at: now,
          }
        : {
            entry_id: crypto.randomUUID(),
            owner,
            stream: piece.stream,
            piece_id: id,
            title: piece.title,
            channel,
            post_copy: variants[channel],
            media: piece.media ?? [],
            publish_mode: modeFor(channel),
            /** Short or landscape, decided while authoring and carried on the entry (D84). */
            youtube_type: piece.youtube_type,
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
