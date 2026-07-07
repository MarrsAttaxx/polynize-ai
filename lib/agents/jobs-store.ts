/**
 * The agent socket's async backbone — Phase-1 INTERIM.
 *
 * Backs the `jobs` contract (docs/pam-console/agent-socket-contract.md) onto the
 * existing content_shoot_sheets table via an owner-scoped key (`jobs/{owner}/{jobId}`),
 * so the socket works BEFORE migration 0009 (the real `jobs` table). When 0009
 * lands, swap the internals here to the jobs table; callers do not change.
 *
 * Server-side only. A pull worker (real April) will read queued rows and flip
 * them; the interim provider writes output inline and flips them itself.
 */

import { getSheetState, saveSheetState } from '@/lib/content/shoot-sheet-store';
import { supabaseService } from '@/lib/supabase';
import type { JobStatus, JobType } from './socket';

export type JobRecord = {
  job_id: string;
  owner: string;
  /** Which agent handles this job (the pull worker filters claims by it). */
  agent: string;
  job_type: JobType;
  status: JobStatus;
  input: unknown;
  output_ref?: string;
  error?: string;
  created_at: string;
  updated_at: string;
};

/**
 * Routing: which agent handles each job type. The console tags a job at enqueue
 * so the right pull worker claims it. All marketing production is April's for now.
 */
const JOB_AGENT: Record<JobType, string> = {
  concept_finalize: 'april',
  script_draft: 'april',
};

function keyFor(owner: string, jobId: string): string {
  return `jobs/${owner}/${jobId}`;
}

function isJobRecord(x: unknown): x is JobRecord {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const j = x as Record<string, unknown>;
  return (
    typeof j.job_id === 'string' &&
    typeof j.owner === 'string' &&
    typeof j.agent === 'string' &&
    typeof j.job_type === 'string' &&
    typeof j.status === 'string'
  );
}

export async function createJob(
  owner: string,
  jobType: JobType,
  input: unknown
): Promise<JobRecord> {
  const now = new Date().toISOString();
  const job: JobRecord = {
    job_id: crypto.randomUUID(),
    owner,
    agent: JOB_AGENT[jobType],
    job_type: jobType,
    status: 'queued',
    input,
    created_at: now,
    updated_at: now,
  };
  await saveSheetState(keyFor(owner, job.job_id), job);
  return job;
}

/**
 * Load a job by id. Owner-scoped: the caller passes the owner from the session,
 * so a job id alone cannot read another owner's job.
 */
export async function getJob(owner: string, jobId: string): Promise<JobRecord | null> {
  const s = await getSheetState(keyFor(owner, jobId));
  return isJobRecord(s) ? s : null;
}

/** Patch a job (status/output/error). Returns the updated record, or null if absent. */
export async function updateJob(
  owner: string,
  jobId: string,
  patch: Partial<Pick<JobRecord, 'status' | 'output_ref' | 'error'>>
): Promise<JobRecord | null> {
  const current = await getJob(owner, jobId);
  if (!current) return null;
  const next: JobRecord = {
    ...current,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  await saveSheetState(keyFor(owner, jobId), next);
  return next;
}

/** Scan all interim job rows (across owners). Server-side; used by the agent API. */
async function scanJobs(): Promise<JobRecord[]> {
  const { data, error } = await supabaseService()
    .from('content_shoot_sheets')
    .select('episode_id, state')
    .like('episode_id', 'jobs/%');
  if (error) throw new Error(`jobs scan failed: ${error.message}`);
  return (data ?? [])
    .map((r) => (r as { state: unknown }).state)
    .filter(isJobRecord);
}

/**
 * Find a job by id alone (agents send back only the id on complete). Scans, so
 * O(n) — fine for the interim small-team volume; the real jobs table makes this a
 * primary-key lookup.
 */
export async function findJob(jobId: string): Promise<JobRecord | null> {
  const all = await scanJobs();
  return all.find((j) => j.job_id === jobId) ?? null;
}

/**
 * A job left `running` longer than this is treated as abandoned (worker crashed
 * or lost connectivity before completing) and becomes reclaimable, so a restarted
 * worker recovers it instead of it being stuck forever. Sized well above a normal
 * concept synthesis (seconds to a couple of minutes).
 */
const LEASE_MS = 10 * 60 * 1000;

/**
 * Claim the oldest claimable job for an agent: flip -> running and return it, or
 * null if none. Claimable = queued OR a `running` job past its lease (crashed
 * worker). The owner comes from the job record, never from the caller.
 *
 * Interim caveat: this read-then-write claim is NOT atomic, so two concurrent
 * pollers for the same agent could double-claim. There is exactly one poller per
 * agent by design, so this holds; the real jobs table closes it with
 * `UPDATE ... WHERE status='queued' RETURNING`.
 */
export async function claimOldestQueued(agent: string): Promise<JobRecord | null> {
  const now = Date.now();
  const claimable = (await scanJobs())
    .filter((j) => {
      if (j.agent !== agent) return false;
      if (j.status === 'queued') return true;
      if (j.status === 'running') {
        const t = Date.parse(j.updated_at);
        return Number.isFinite(t) && now - t > LEASE_MS;
      }
      return false;
    })
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const job = claimable[0];
  if (!job) return null;
  return (await updateJob(job.owner, job.job_id, { status: 'running' })) ?? job;
}
