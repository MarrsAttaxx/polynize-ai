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
import type { JobStatus, JobType } from './socket';

export type JobRecord = {
  job_id: string;
  owner: string;
  job_type: JobType;
  status: JobStatus;
  input: unknown;
  output_ref?: string;
  error?: string;
  created_at: string;
  updated_at: string;
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
