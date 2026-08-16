/**
 * The real-April provider (AGENT_PROVIDER=hermes).
 *
 * Two halves, per the locked design:
 * - converse (the live interview) runs CONSOLE-SIDE in April's name (Option B):
 *   her interviewer persona + the owner's brand-voice doc (from the bucket), billed
 *   to April's own OpenRouter key. Fast, no round-trip, and consistent with D3
 *   (interface-driving = console-side).
 * - submitJob only ENQUEUES (queued); the real April pull worker claims it via
 *   /api/agents/jobs/claim, synthesises, and reports via /complete. The console
 *   never runs the concept synthesis itself here.
 *
 * Selected by getAgentProvider(); dormant until AGENT_PROVIDER=hermes. Server-side.
 */

import { complete } from '@/lib/llm';
import { stripEmDashes } from '@/lib/em-dash';
import { interviewerSystemPrompt } from './prompts';
import { getBrandVoiceForStream } from '@/lib/marketing/brand-voice-store';
import { createJob, getJob } from './jobs-store';
import type {
  AgentProvider,
  ConverseRequest,
  ConverseResult,
  JobView,
  SubmitJobRequest,
} from './socket';

async function converse(req: ConverseRequest): Promise<ConverseResult> {
  // Per-stream brand voice (D20): the interview register follows the stream the
  // content is for, not the signed-in user. No stream → no personal register.
  const brandVoice = req.stream
    ? await getBrandVoiceForStream(req.stream)
    : undefined;
  const reply = await complete({
    system: interviewerSystemPrompt(brandVoice),
    messages: [...req.history, { role: 'user', content: req.message }],
    /**
     * ABOVE THE REASONING FLOOR. The production model is a thinking model whose reasoning
     * tokens are mandatory, undisableable, and counted against max_tokens: measured at roughly
     * 800-950 on this codebase. A ceiling below that is spent entirely on reasoning and returns
     * an EMPTY string, which on screen looks like the agent not answering at all rather than
     * like an error. Same fault that truncated drafts (decision log, 2026-07-20); the short
     * conversational calls were missed at the time.
     */
    maxTokens: 2500,
    temperature: 0.7,
    json: false,
    // Bill April's own key when set; falls back to the console's key otherwise.
    apiKey: process.env.APRIL_OPENROUTER_API_KEY,
  });
  return { reply: stripEmDashes(reply.trim()) };
}

async function submitJob(req: SubmitJobRequest): Promise<{ jobId: string }> {
  // Enqueue only. The real April pull worker does the work and reports via the
  // agent API; the console never runs it inline in this provider.
  const job = await createJob(req.owner, req.jobType, req.input);
  return { jobId: job.job_id };
}

async function jobStatus(owner: string, jobId: string): Promise<JobView> {
  const job = await getJob(owner, jobId);
  if (!job) return { status: 'failed', error: 'job not found' };
  return { status: job.status, outputRef: job.output_ref, error: job.error };
}

export const hermesProvider: AgentProvider = {
  converse,
  submitJob,
  jobStatus,
};
