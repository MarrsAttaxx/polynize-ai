import { NextResponse } from 'next/server';
import { z } from 'zod';
import { complete } from '@/lib/llm';
import {
  SALES_BLUEPRINT_REVISE_SYSTEM_PROMPT,
  buildSalesBlueprintReviseUserMessage,
} from '@/lib/agents/sales-blueprint-prompt';
import { validateSalesBlueprint } from '@/lib/agents/sales-blueprint-schema';
import { stripEmDashes } from '@/lib/em-dash';
import type { SalesBlueprint } from '@/lib/agents/sales-blueprint-schema';

export const runtime = 'nodejs';
export const maxDuration = 300;

const HARD_ATTEMPT_TIMEOUT_MS = 250_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms deadline`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

const BodySchema = z.object({
  current: z.record(z.string(), z.unknown()),
  instruction: z.string().min(1).max(2000),
});

/**
 * POST /api/blueprint-map/revise
 *
 * Applies a plain-language edit to an existing blueprint and returns the full
 * updated envelope plus a one-line summary of what changed. Powers the chat
 * editor on /blueprint.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  const userMessage = buildSalesBlueprintReviseUserMessage(body.current, body.instruction);
  const startedAt = Date.now();
  console.log(`[blueprint-map.revise] starting, instruction="${body.instruction.slice(0, 80)}"`);

  let raw: string | null = null;
  try {
    raw = await withTimeout(
      complete({
        system: SALES_BLUEPRINT_REVISE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        maxTokens: 16000,
        temperature: 0.3,
      }),
      HARD_ATTEMPT_TIMEOUT_MS,
      'LLM call'
    );

    const parsed = parseJsonLoose(raw) as Record<string, unknown>;
    const candidate =
      parsed && typeof parsed === 'object' && 'blueprint' in parsed ? parsed.blueprint : parsed;
    const validation = validateSalesBlueprint(candidate);
    if (!validation.ok) {
      console.error(`[blueprint-map.revise] VALIDATION FAILED: ${validation.error}`);
      console.error(`[blueprint-map.revise] raw (first 2000): ${raw.slice(0, 2000)}`);
      return NextResponse.json(
        { ok: false, error: 'revise_failed', detail: validation.error },
        { status: 502 }
      );
    }

    const cleaned = stripEmDashesRecursively(validation.data) as SalesBlueprint;
    const summaryRaw = typeof parsed?.summary === 'string' ? parsed.summary : 'Updated the blueprint.';
    const summary = stripEmDashes(summaryRaw);
    console.log(`[blueprint-map.revise] OK (${Date.now() - startedAt}ms): ${summary}`);
    return NextResponse.json({ ok: true, data: cleaned, summary });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error(`[blueprint-map.revise] THREW: ${detail}`);
    if (raw) console.error(`[blueprint-map.revise] raw (first 2000): ${raw.slice(0, 2000)}`);
    return NextResponse.json({ ok: false, error: 'revise_failed', detail }, { status: 502 });
  }
}

function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenceMatch ? fenceMatch[1] : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in LLM response');
  return JSON.parse(candidate.slice(start, end + 1));
}

function stripEmDashesRecursively(value: unknown): unknown {
  if (typeof value === 'string') return stripEmDashes(value);
  if (Array.isArray(value)) return value.map(stripEmDashesRecursively);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripEmDashesRecursively(v);
    }
    return out;
  }
  return value;
}
