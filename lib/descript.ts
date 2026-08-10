/**
 * DESCRIPT REST client.
 *
 * Descript is the cutting engine for podcast clips (see
 * `docs/pam-console/podcast-clip-extraction.md`): April proposes the edit decision list, a human
 * approves it, and Descript's own agent executes the cut. That division exists because Descript
 * owns the timeline and the transcript-to-media mapping, and reimplementing either would be worse
 * than asking it.
 *
 * WHY A REST CLIENT AND NOT THE MCP. Assembly was first proven through Descript's MCP server, which
 * is only reachable from a developer's machine. The console runs on Vercel and cannot use it, so
 * until now the pipeline could only ever have been half-automated. Descript does publish a REST API
 * at descriptapi.com/v1 with the same agent capability, so the console can run the whole loop
 * itself. Needs DESCRIPT_API_TOKEN (Descript > Settings > API tokens).
 *
 * Server-side only. The token is never sent to the browser.
 */

const BASE = 'https://descriptapi.com/v1';

/** Everything here needs the token, so one check with one honest message. */
function token(): string {
  const t = process.env.DESCRIPT_API_TOKEN;
  if (!t) {
    throw new DescriptError(
      'Descript is not connected. Add DESCRIPT_API_TOKEN in Vercel, then redeploy.',
      'no-token'
    );
  }
  return t;
}

export type DescriptFailure = 'no-token' | 'http' | 'job-failed' | 'timeout' | 'not-found';

export class DescriptError extends Error {
  constructor(
    message: string,
    readonly reason: DescriptFailure
  ) {
    super(message);
    this.name = 'DescriptError';
  }
}

export function isDescriptConfigured(): boolean {
  return Boolean(process.env.DESCRIPT_API_TOKEN);
}

async function call<T>(
  path: string,
  init?: { method?: string; body?: unknown; raw?: boolean }
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new DescriptError(
      `Descript ${res.status} on ${path}: ${text.slice(0, 300)}`,
      res.status === 404 ? 'not-found' : 'http'
    );
  }
  // The transcript export returns a raw document rather than JSON.
  if (init?.raw) return (await res.text()) as unknown as T;
  return (await res.json()) as T;
}

export type DescriptProject = {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
  folder_path?: string;
};

export type DescriptComposition = {
  id: string;
  name: string;
  duration: number;
  media_type?: string;
};

export type DescriptProjectDetail = DescriptProject & {
  drive_id?: string;
  media_files?: Record<string, { type?: string; duration?: number }>;
  compositions?: DescriptComposition[];
  publishes?: { share_url?: string; media_type?: string }[];
};

/** Projects, newest activity first, optionally filtered by name. */
export async function listProjects(opts?: { name?: string; limit?: number }) {
  const q = new URLSearchParams({
    sort: 'updated_at',
    direction: 'desc',
    limit: String(opts?.limit ?? 30),
    ...(opts?.name ? { name: opts.name } : {}),
  });
  const body = await call<{ data?: DescriptProject[] }>(`/projects?${q.toString()}`);
  return body.data ?? [];
}

export async function getProject(projectId: string) {
  return call<DescriptProjectDetail>(`/projects/${projectId}`);
}

/**
 * The transcript, with the anchors the whole clip method depends on.
 *
 * Timecodes on paragraphs AND speaker changes, because the EDL references `[HH:MM:SS]` paragraph
 * anchors: without them April has no way to tell the assembly engine WHERE a span is, and the
 * proposals become unusable prose. Speaker labels matter too, since a two-person episode reads as
 * nonsense without them and the hook has to be attributable.
 */
export async function exportTranscript(projectId: string, compositionId?: string) {
  return call<string>('/export/transcript', {
    method: 'POST',
    raw: true,
    body: {
      project_id: projectId,
      ...(compositionId ? { composition_id: compositionId } : {}),
      format: 'txt',
      include_speaker_labels: 'changes',
      timecodes: { on_paragraphs: true, on_speakers: true },
    },
  });
}

export type AgentJobStarted = {
  job_id: string;
  project_id?: string;
  project_url?: string;
  conversation_id?: string;
  resolved_model?: string;
};

/**
 * Hand an instruction to Descript's own editing agent.
 *
 * `claude-opus-4.8` by default: the assembly proof found that adherence to a precise cut list is
 * what matters here, and the cheaper models wander. Overridable via DESCRIPT_AGENT_MODEL.
 */
export async function startAgentJob(args: {
  projectId: string;
  compositionId?: string;
  prompt: string;
  callbackUrl?: string;
}) {
  return call<AgentJobStarted>('/jobs/agent', {
    method: 'POST',
    body: {
      project_id: args.projectId,
      ...(args.compositionId ? { composition_id: args.compositionId } : {}),
      prompt: args.prompt,
      model: process.env.DESCRIPT_AGENT_MODEL || 'claude-opus-4.8',
      ...(args.callbackUrl ? { callback_url: args.callbackUrl } : {}),
    },
  });
}

/**
 * Job states are `queued`, `running`, `stopped` and `cancelled`.
 *
 * NOTE THE TRAP, which is why this is normalised here once: `stopped` is not success. It means the
 * job is no longer running, and whether it worked is in `result.status`. Treating `stopped` as done
 * would report every failed assembly as a finished clip.
 */
export type DescriptJob = {
  job_id: string;
  job_type?: string;
  job_state?: string;
  project_id?: string;
  project_url?: string;
  stopped_at?: string;
  /**
   * `status` decides success. `agent_response` is where the editing agent's own report lands, which is
   * the only place the new composition's id and what it actually did appear.
   */
  result?: {
    status?: string;
    message?: string;
    agent_response?: string;
    ai_credits_used?: number;
    [k: string]: unknown;
  };
};

export type JobOutcome = 'running' | 'done' | 'failed' | 'cancelled';

export function jobOutcome(job: DescriptJob): JobOutcome {
  const state = (job.job_state ?? '').toLowerCase();
  if (state === 'queued' || state === 'running') return 'running';
  if (state === 'cancelled') return 'cancelled';
  if (state === 'stopped') {
    const status = (job.result?.status ?? '').toLowerCase();
    // An empty status on a stopped job is ambiguous, and calling it success would be the
    // dangerous reading, so it is treated as failure and the raw value is logged.
    if (status && /success|complete|done|ok/.test(status)) return 'done';
    console.warn(`[descript] job ${job.job_id} stopped with result.status=${JSON.stringify(job.result?.status)}`);
    return 'failed';
  }
  // An unrecognised state is reported as still running rather than guessed at, so a poll retries
  // instead of declaring an outcome that may be wrong.
  console.warn(`[descript] job ${job.job_id} unknown job_state=${JSON.stringify(job.job_state)}`);
  return 'running';
}

export async function getJob(jobId: string) {
  return call<DescriptJob>(`/jobs/${jobId}`);
}
