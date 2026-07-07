import { timingSafeEqual } from 'node:crypto';

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function verifyAgentApiKey(request: Request): boolean {
  const expected = process.env.CONSOLE_AGENT_API_KEY;
  if (!expected) return false;

  const header = request.headers.get('authorization');
  if (!header) return false;

  const separator = header.indexOf(' ');
  if (separator === -1) return false;

  const scheme = header.slice(0, separator);
  const key = header.slice(separator + 1).trim();
  if (scheme.toLowerCase() !== 'bearer' || !key) return false;

  return constantTimeEqual(key, expected);
}

/**
 * Per-agent bearer tokens for the marketing agent pull API. Each agent gets its
 * OWN token (env `PAM_AGENT_TOKEN_<AGENT>`), so a token can only act as its agent
 * (April's token can only claim/complete April's jobs). Add entries as agents
 * come online. Ben's shared CONSOLE_AGENT_API_KEY (above) is unaffected.
 */
const AGENT_TOKEN_ENV: Record<string, string> = {
  april: 'PAM_AGENT_TOKEN_APRIL',
};

function bearerFrom(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const separator = header.indexOf(' ');
  if (separator === -1) return null;
  if (header.slice(0, separator).toLowerCase() !== 'bearer') return null;
  const key = header.slice(separator + 1).trim();
  return key || null;
}

/**
 * Resolve which agent a request is authenticated as, or null. Constant-time
 * comparison against each configured per-agent token.
 */
export function authenticateAgent(request: Request): string | null {
  const key = bearerFrom(request);
  if (!key) return null;
  let matched: string | null = null;
  for (const [agent, envName] of Object.entries(AGENT_TOKEN_ENV)) {
    const expected = process.env[envName];
    if (expected && constantTimeEqual(key, expected)) {
      matched = agent;
    }
  }
  return matched;
}
