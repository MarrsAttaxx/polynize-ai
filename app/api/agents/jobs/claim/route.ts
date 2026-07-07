/**
 * POST /api/agents/jobs/claim — an agent pull worker claims its next job.
 *
 * Bearer-authed per agent (PAM_AGENT_TOKEN_<AGENT>); the agent identity comes from
 * the TOKEN, never the body, so a token can only claim its own agent's jobs. Flips
 * the oldest queued job for that agent queued -> running and returns it with inline
 * input. Returns { job: null } when the queue is empty. Outbound-only for the
 * agent: no inbound surface, no Supabase/S3 credential on the agent box (D16/D17,
 * agent-socket-contract).
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/agent-auth';
import { isAgentBridgeActive } from '@/lib/agents/socket';
import { claimOldestQueued } from '@/lib/agents/jobs-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // Inert until the flip, even if a token is already staged — otherwise a poller
  // could steal an interim job the interim provider is about to run inline.
  if (!isAgentBridgeActive()) {
    return NextResponse.json({ error: 'agent bridge inactive' }, { status: 503 });
  }
  const agent = authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const job = await claimOldestQueued(agent);
    return NextResponse.json(
      {
        job: job
          ? { id: job.job_id, job_type: job.job_type, owner: job.owner, input: job.input }
          : null,
      },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (e) {
    console.error(`[agents.claim] ${agent}: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ error: 'claim failed' }, { status: 500 });
  }
}
