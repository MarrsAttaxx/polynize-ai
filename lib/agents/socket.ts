/**
 * The agent socket — the transport-abstract seam between the console (conductor)
 * and the agents (plugs). See docs/pam-console/agent-socket-contract.md.
 *
 * Two capabilities:
 *   - converse: synchronous, interface-driving (interview turns, script chat).
 *   - jobs:     async submit -> job_id -> status -> output_ref (productions).
 *
 * The console never knows which runtime is behind the seam. Today the only
 * provider is the interim OpenRouter stand-in (D1 interim runtime). When the
 * real agents (April / Mikey, via a pull worker) are provisioned, they register
 * here and getAgentProvider() returns them — a config change, not a screen change.
 */

export type AgentName = 'april' | 'script_editor';
export type Message = { role: 'user' | 'assistant'; content: string };

export type JobType = 'concept_finalize' | 'script_draft';
export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface ConverseRequest {
  agent: AgentName;
  owner: string;
  /** Conditioning the agent reads (brand voice, the concept-in-progress, format). */
  systemContext?: {
    brandVoice?: string;
    concept?: string;
    format?: string;
    title?: string;
  };
  history: Message[];
  message: string;
}

export interface ConverseResult {
  reply: string;
  /** The agent's optional hint that it has enough to finalize. Advisory only. */
  signal?: 'ready_to_finalize';
}

export interface SubmitJobRequest {
  jobType: JobType;
  owner: string;
  input: unknown;
}

export interface JobView {
  status: JobStatus;
  outputRef?: string;
  error?: string;
}

export interface AgentProvider {
  converse(req: ConverseRequest): Promise<ConverseResult>;
  submitJob(req: SubmitJobRequest): Promise<{ jobId: string }>;
  /** Owner-scoped: jobs are owner-partitioned, so a job id alone can't read across owners. */
  jobStatus(owner: string, jobId: string): Promise<JobView>;
}

/**
 * Select the active provider. Interim (OpenRouter stand-in) is the only one until
 * the real agents are provisioned; `AGENT_PROVIDER` is the swap point.
 */
/**
 * Is the real-agent pull bridge active? The claim/complete API must be inert
 * unless we have flipped to the real agents, EVEN IF a per-agent token is already
 * set (pre-flip staging). Otherwise a live poller could claim an interim job that
 * the interim provider is about to run inline, and both would execute it.
 */
export function isAgentBridgeActive(): boolean {
  return (process.env.AGENT_PROVIDER ?? 'interim') === 'hermes';
}

export async function getAgentProvider(): Promise<AgentProvider> {
  const which = process.env.AGENT_PROVIDER ?? 'interim';
  switch (which) {
    case 'hermes': {
      // The real agents: console-run interview + pull-worker jobs.
      const { hermesProvider } = await import('./hermes-provider');
      return hermesProvider;
    }
    case 'interim':
    default: {
      const { interimProvider } = await import('./interim-provider');
      return interimProvider;
    }
  }
}
