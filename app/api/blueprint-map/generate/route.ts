import { NextResponse } from 'next/server';
import { z } from 'zod';
import { complete } from '@/lib/llm';
import {
  SALES_BLUEPRINT_SYSTEM_PROMPT,
  buildSalesBlueprintUserMessage,
} from '@/lib/agents/sales-blueprint-prompt';
import { validateSalesBlueprint } from '@/lib/agents/sales-blueprint-schema';
import { stripEmDashes } from '@/lib/em-dash';
import type { SalesBlueprint } from '@/lib/agents/sales-blueprint-schema';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Single generous attempt, mirroring /api/capability-map/generate. */
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

const BodySchema = z.object({ payload: z.string().min(20).max(20000) });

/**
 * POST /api/blueprint-map/generate
 *
 * Takes a raw pasted working-session payload and returns a SalesBlueprint
 * envelope. No fallback: it either returns a real map or a structured error
 * the /blueprint UI renders as a retry state (same posture as the v0.5
 * capability-map route).
 */
export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  const userMessage = buildSalesBlueprintUserMessage(body.payload);
  const provider = process.env.LLM_PROVIDER ?? 'openrouter';
  const routeStartedAt = Date.now();
  console.log(`[blueprint-map.generate] starting, provider=${provider}`);

  let lastError = 'unknown';
  let raw: string | null = null;
  const attemptStartedAt = Date.now();
  try {
    raw = await withTimeout(
      complete({
        system: SALES_BLUEPRINT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        maxTokens: 16000,
        temperature: 0.5,
      }),
      HARD_ATTEMPT_TIMEOUT_MS,
      'LLM call'
    );
    console.log(
      `[blueprint-map.generate] LLM returned in ${Date.now() - attemptStartedAt}ms, raw length ${raw.length}`
    );

    const json = parseJsonLoose(raw);
    const validation = validateSalesBlueprint(json);
    if (!validation.ok) {
      lastError = `schema validation failed: ${validation.error}`;
      console.error(`[blueprint-map.generate] VALIDATION FAILED: ${validation.error}`);
      console.error(`[blueprint-map.generate] raw (first 2000): ${raw.slice(0, 2000)}`);
    } else {
      const cleaned = stripEmDashesRecursively(validation.data) as SalesBlueprint;
      console.log(`[blueprint-map.generate] OK (total ${Date.now() - routeStartedAt}ms)`);
      return NextResponse.json({ ok: true, data: cleaned });
    }
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    console.error(`[blueprint-map.generate] THREW after ${Date.now() - attemptStartedAt}ms: ${lastError}`);
    if (raw) console.error(`[blueprint-map.generate] raw (first 2000): ${raw.slice(0, 2000)}`);
  }

  console.error(`[blueprint-map.generate] failed after ${Date.now() - routeStartedAt}ms: ${lastError}`);
  return NextResponse.json(
    { ok: false, error: 'generation_failed', detail: lastError },
    { status: 502 }
  );
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
