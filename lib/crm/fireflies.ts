/**
 * Fireflies -> CRM candidates.
 *
 * Marrs asked for meetings to become contacts. Testing the real account against the MCP
 * first changed the design twice, and both changes are load-bearing:
 *
 * 1. HIS TEAM WOULD HAVE FLOODED THE CRM. One "Polynize Weekly Sync" carries twelve
 *    attendees, all internal. Unfiltered, that is eleven junk contacts from a single
 *    meeting. So a meeting only produces candidates from EXTERNAL attendees, and a meeting
 *    with no external attendee produces nothing at all.
 *
 * 2. HIS FIREFLIES ALSO HOLDS PERSONAL MEETINGS, including a medical appointment in the
 *    most recent five. Nothing in an automated pull could know to leave that alone. That is
 *    exactly the risk D25 postponed this integration over, and it is why NOTHING HERE
 *    WRITES A CONTACT. This module only proposes; a person ticks the ones that are real.
 *    The review step costs one click and removes the entire class of problem.
 *
 * Also learned from the real data: `displayName` is null on every attendee, so only an
 * email is available. The name is left EMPTY rather than guessed from the local part of the
 * address, because "aj@optio.capital" becoming a contact called "Aj" is worse than blank.
 */

/** Domains that are us. Anyone at one of these is a colleague, not a lead. */
export const INTERNAL_DOMAINS = ['polynize.io', 'polynize.com'];

export function isFirefliesConfigured(): boolean {
  return Boolean(process.env.FIREFLIES_API_KEY?.trim());
}

export function domainOf(email: string): string {
  const at = email.lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1).trim().toLowerCase();
}

export function isInternal(email: string, domains: string[] = INTERNAL_DOMAINS): boolean {
  const d = domainOf(email);
  return d !== '' && domains.some((x) => d === x.toLowerCase());
}

export type FirefliesMeeting = {
  id: string;
  title: string;
  dateString?: string;
  attendees: string[];
  summary?: string;
  organizerEmail?: string;
};

/** One proposed contact, awaiting a tick. */
export type Candidate = {
  email: string;
  /** The meeting it came from, so he can tell a real lead from a personal appointment. */
  meetingTitle: string;
  meetingDate?: string;
  transcriptUrl: string;
  /** The meeting summary, which becomes the contact's notes if accepted. */
  summary?: string;
};

const ENDPOINT = 'https://api.fireflies.ai/graphql';

/**
 * The query is deliberately small. Every extra field is another chance for a schema
 * mismatch to fail the whole request, and this needs the attendee emails, a title so a
 * human can judge the meeting, and the summary for the notes. Nothing else.
 */
const QUERY = `query Transcripts($limit: Int, $skip: Int) {
  transcripts(limit: $limit, skip: $skip) {
    id
    title
    dateString
    organizer_email
    participants
    meeting_attendees { email displayName }
    summary { short_summary }
  }
}`;

type RawTranscript = {
  id?: string;
  title?: string;
  dateString?: string;
  organizer_email?: string;
  participants?: unknown;
  meeting_attendees?: { email?: string; displayName?: string | null }[] | null;
  summary?: { short_summary?: string | null } | null;
};

/**
 * Recent meetings from Fireflies.
 *
 * Throws with the API's own message on failure rather than returning []. An empty list and
 * a broken key look identical on screen, and "no meetings found" when the real answer is
 * "your key is wrong" is the kind of error that wastes an afternoon.
 */
export async function fetchRecentMeetings(opts?: {
  limit?: number;
  skip?: number;
}): Promise<FirefliesMeeting[]> {
  const key = process.env.FIREFLIES_API_KEY?.trim();
  if (!key) throw new Error('FIREFLIES_API_KEY is not set');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { limit: Math.min(opts?.limit ?? 25, 50), skip: opts?.skip ?? 0 },
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Fireflies returned ${res.status}: ${text.slice(0, 300)}`);
  }

  let parsed: { data?: { transcripts?: RawTranscript[] }; errors?: { message?: string }[] };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error(`Fireflies returned something that is not JSON: ${text.slice(0, 200)}`);
  }
  // GraphQL reports field errors with HTTP 200, so this has to be checked separately or a
  // mistyped field name would look like an account with no meetings in it.
  if (parsed.errors?.length) {
    throw new Error(`Fireflies rejected the query: ${parsed.errors.map((e) => e.message).join('; ')}`);
  }

  return (parsed.data?.transcripts ?? []).map((t) => {
    const fromAttendees = (t.meeting_attendees ?? [])
      .map((a) => (typeof a?.email === 'string' ? a.email.trim().toLowerCase() : ''))
      .filter((e) => e !== '');
    const fromParticipants = Array.isArray(t.participants)
      ? t.participants
          .map((p) => (typeof p === 'string' ? p.trim().toLowerCase() : ''))
          .filter((e) => e !== '' && e.includes('@'))
      : [];
    return {
      id: String(t.id ?? ''),
      title: typeof t.title === 'string' ? t.title : '(untitled meeting)',
      dateString: typeof t.dateString === 'string' ? t.dateString : undefined,
      // Both lists, because the real data showed meeting_attendees empty on several
      // meetings while participants still held the addresses.
      attendees: [...new Set([...fromAttendees, ...fromParticipants])],
      summary:
        typeof t.summary?.short_summary === 'string' && t.summary.short_summary.trim()
          ? t.summary.short_summary.trim()
          : undefined,
      organizerEmail:
        typeof t.organizer_email === 'string' ? t.organizer_email.trim().toLowerCase() : undefined,
    };
  });
}

export function transcriptUrl(id: string): string {
  return `https://app.fireflies.ai/view/${id}`;
}

/**
 * Meetings -> proposed contacts. Pure, so the filtering is testable without the API.
 *
 * One candidate per external attendee. A meeting whose only attendees are internal yields
 * nothing, which is what keeps the weekly sync out of the CRM. Already-known addresses are
 * dropped rather than shown as duplicates.
 */
export function meetingsToCandidates(
  meetings: FirefliesMeeting[],
  opts: { alreadyHave: Set<string>; internalDomains?: string[] }
): Candidate[] {
  const domains = opts.internalDomains ?? INTERNAL_DOMAINS;
  const out: Candidate[] = [];
  const seen = new Set<string>();

  for (const m of meetings) {
    if (!m.id) continue;
    for (const email of m.attendees) {
      if (isInternal(email, domains)) continue;
      if (opts.alreadyHave.has(email)) continue;
      // The same person across three meetings is one candidate, from the most recent one.
      // Meetings arrive newest first, so the first sighting is the one to keep.
      if (seen.has(email)) continue;
      seen.add(email);
      out.push({
        email,
        meetingTitle: m.title,
        meetingDate: m.dateString,
        transcriptUrl: transcriptUrl(m.id),
        summary: m.summary,
      });
    }
  }
  return out;
}

/** The notes a accepted candidate starts with. */
export function notesFor(c: Candidate): string {
  const when = c.meetingDate ? c.meetingDate.slice(0, 10) : 'unknown date';
  return [`From the meeting "${c.meetingTitle}" (${when}).`, '', c.summary ?? '', '', `Transcript: ${c.transcriptUrl}`]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n')
    .trim();
}
