import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';
import { complete } from '@/lib/llm';
import { supabaseService } from '@/lib/supabase';
import { captureLead } from '@/lib/leads';
import { stripEmDashes } from '@/lib/em-dash';
import {
  JOB_BLUEPRINT_SYSTEM_PROMPT,
  buildJobBlueprintUserMessage,
} from '@/lib/agents/job-blueprint-prompt';
import { validateJobBlueprint } from '@/lib/agents/job-blueprint-schema';
import { sendJobBlueprintEmail } from '@/lib/agents/job-blueprint-email';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** One generous attempt, same posture as the other generate routes. */
const HARD_ATTEMPT_TIMEOUT_MS = 240_000;

const BodySchema = z.object({
  jd: z.string().min(120).max(30000),
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
});

/**
 * POST /api/job-map/start
 *
 * THE SHAPE OF THIS ROUTE IS THE WHOLE DESIGN, so it is worth stating plainly.
 *
 * It returns an id in about a second, then keeps working after the response has been sent,
 * via Vercel's waitUntil. That is what lets the page do both of the things Marrs asked for
 * at once: a visitor who stays watches it finish and reads it inline, and a visitor who
 * closes the tab gets an email. Generating inside the request would force a choice between
 * those two.
 *
 * ORDER MATTERS HERE AND IS NOT ARBITRARY:
 *   1. insert the row (pending) so there is something to poll and something to email to
 *   2. capture the lead, before any generation can fail. The lead is the commercial point
 *      of the page and it must not depend on the model behaving.
 *   3. respond
 *   4. generate, save, email, in the background
 *
 * THE JOB DESCRIPTION IS NEVER PERSISTED. It lives in this function's memory for the length
 * of the generation and goes no further. There is no column for it (migration 0013).
 *
 * WHAT waitUntil DOES AND DOES NOT GIVE US. It keeps the invocation alive past the response
 * for the remainder of maxDuration, which is plenty for a generation measured in tens of
 * seconds. It is NOT durable: if the instance dies mid-flight, the row stays `pending` and
 * nothing retries it. That is an accepted trade for a lead-gen funnel, and it is why the
 * failure is written to the row rather than only logged. A stuck `pending` row is the
 * signal to look.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: 'Persistence not configured' }, { status: 503 });
  }

  const sb = supabaseService();
  const { data: row, error: insertError } = await sb
    .from('job_blueprints')
    .insert({ status: 'pending', name: body.name, email: body.email })
    .select('id')
    .single();

  if (insertError || !row) {
    console.error('[job-map.start] insert failed', insertError);
    return NextResponse.json({ ok: false, error: 'Could not start' }, { status: 503 });
  }

  const id: string = row.id;

  /**
   * NO blueprintId, AND THAT IS THE LOAD-BEARING PART. `leads.blueprint_id` is a foreign
   * key to sales_blueprints (migration 0011). Passing this route's job_blueprints id failed
   * that FK check, and because captureLead swallows write errors by design the lead vanished
   * without a trace: the row inserted, the map generated, the email sent, and the one record
   * that pays for the page was simply absent. Found by querying the leads table after an
   * end-to-end run rather than trusting that it worked.
   *
   * The link back is `job_blueprints.email`, which this route already stores, so nothing is
   * lost by leaving the column unset. `source` is what tells a job map apart from a team map
   * in the CRM.
   *
   * Awaited rather than fired and forgotten, because on Vercel the invocation can be frozen
   * the moment the response is returned. captureLead never throws and is one upsert, so this
   * costs tens of milliseconds and makes the write certain before we tell anyone we started.
   */
  const leadLanded = await captureLead({
    email: body.email,
    name: body.name,
    source: 'job_map',
  });
  if (!leadLanded) console.error(`[job-map.start] ${id} lead capture failed for ${body.email}`);

  const baseUrl = originFrom(req);
  waitUntil(runGeneration({ id, jd: body.jd, name: body.name, email: body.email, baseUrl }));

  return NextResponse.json({ ok: true, id });
}

async function runGeneration(args: {
  id: string;
  jd: string;
  name: string;
  email: string;
  baseUrl: string;
}) {
  const { id, jd, name, email, baseUrl } = args;
  const sb = supabaseService();
  const startedAt = Date.now();

  const fail = async (reason: string) => {
    console.error(`[job-map.start] ${id} failed: ${reason}`);
    await sb
      .from('job_blueprints')
      .update({ status: 'failed', error: reason.slice(0, 500), updated_at: new Date().toISOString() })
      .eq('id', id);
  };

  let raw: string;
  try {
    raw = await withTimeout(
      complete({
        system: JOB_BLUEPRINT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildJobBlueprintUserMessage(jd) }],
        maxTokens: 9000,
        temperature: 0.4,
      }),
      HARD_ATTEMPT_TIMEOUT_MS,
      'job blueprint generation'
    );
  } catch (err) {
    await fail(err instanceof Error ? err.message : 'generation threw');
    return;
  }

  const parsed = parseJson(stripEmDashes(raw));
  if (!parsed) {
    await fail('model did not return parseable JSON');
    return;
  }

  const validation = validateJobBlueprint(parsed);
  if (!validation.ok) {
    await fail(`invalid blueprint: ${validation.error}`);
    return;
  }
  const blueprint = validation.data;

  const { error: updateError } = await sb
    .from('job_blueprints')
    .update({
      status: 'ready',
      role_title: blueprint.role_title,
      content: blueprint,
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    await fail(`save failed: ${updateError.message}`);
    return;
  }

  console.log(`[job-map.start] ${id} ready in ${Date.now() - startedAt}ms`);

  // The email is best effort and comes last. A blueprint that saved but could not be sent
  // is still readable at its URL, and the visitor who stayed already has it on screen.
  try {
    const result = await sendJobBlueprintEmail({ to: email, name, id, blueprint, baseUrl });
    if (result.status !== 'skipped') {
      await sb.from('job_blueprints').update({ emailed_at: new Date().toISOString() }).eq('id', id);
    }
  } catch (err) {
    console.error(`[job-map.start] ${id} email failed`, err);
  }
}

/**
 * The absolute origin to build the email link from. Taken from the request rather than an
 * env var so a preview deployment emails a preview link and production emails a production
 * link, which is what you want when testing.
 */
function originFrom(req: Request): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  try {
    return new URL(req.url).origin;
  } catch {
    return 'https://www.polynize.ai';
  }
}

/** Models wrap JSON in prose or fences often enough that this is not optional. */
function parseJson(raw: string): unknown | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], raw, raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)];
  for (const c of candidates) {
    if (!c) continue;
    try {
      return JSON.parse(c.trim());
    } catch {
      /* try the next shape */
    }
  }
  return null;
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
