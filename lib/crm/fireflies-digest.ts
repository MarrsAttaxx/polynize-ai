import { listContacts } from './contact-store';
import { addToEmailSet, getEmailSet } from './email-set-store';
import { fetchRecentMeetings, isFirefliesConfigured, meetingsToCandidates, type Candidate } from './fireflies';
import { getIgnored } from './ignored-store';
import { getNotifyMap, type NotifyMap } from './notify-store';
import { STREAMS, streamLabel } from '@/lib/marketing/streams';
import { sendEmail } from '@/lib/resend-client';

/**
 * THE DAILY "somebody new to review" EMAIL.
 *
 * Marrs asked for the pull to happen automatically. It cannot AUTO-ADD, because his Fireflies
 * holds personal meetings and no filter can tell one from a sales call, which is the whole
 * reason the review list exists. So the automation is the reminder, not the writing: once a
 * day this looks, and if there is somebody new it says so and links to the CRM.
 *
 * THE TRAP THIS AVOIDS. Candidates persist until they are added or dismissed, so a naive
 * daily email would list the same three people every morning until they were dealt with. That
 * is a notification you mute inside a week. So every address mentioned is recorded, and a
 * digest is only sent when there is at least one address that has NEVER been mentioned
 * before. Nothing is sent otherwise, which means silence genuinely means nothing new.
 */

/** Addresses this digest has already told somebody about. */
const DIGESTED = 'pam/config/crm-digested.json';

export type DigestGroup = { owner: string; label: string; fresh: Candidate[]; total: number };

export type DigestResult = {
  /** Why nothing was sent, when nothing was. */
  skipped?: string;
  groups: DigestGroup[];
  freshCount: number;
  sent: number;
};

/**
 * Look across every CRM and find people nobody has been told about yet.
 *
 * One Fireflies call, not one per stream: the meetings are the same list regardless of whose
 * CRM they are being offered to, so fetching five times would be five times the API cost for
 * identical data.
 */
export async function buildDigest(): Promise<DigestGroup[]> {
  const meetings = await fetchRecentMeetings({ limit: 50 });

  const groups: DigestGroup[] = [];
  for (const st of STREAMS) {
    const [existing, ignored, digested] = await Promise.all([
      listContacts(st.id).catch(() => []),
      getIgnored(st.id),
      getEmailSet(DIGESTED, st.id),
    ]);
    const candidates = meetingsToCandidates(meetings, {
      alreadyHave: new Set([...existing.map((c) => c.email.toLowerCase()), ...ignored]),
    });
    const fresh = candidates.filter((c) => !digested.has(c.email));
    if (fresh.length > 0) {
      groups.push({ owner: st.id, label: streamLabel(st.id), fresh, total: candidates.length });
    }
  }
  return groups;
}

function consoleOrigin(): string {
  const raw = process.env.PAM_CONSOLE_ORIGIN?.trim();
  return raw ? raw.replace(/\/+$/, '') : 'https://pam.polynize.ai';
}

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build and send it. Never throws: a failed digest must not fail the cron invocation in a way
 * that looks like an outage.
 */
export async function runDigest(): Promise<DigestResult> {
  if (!isFirefliesConfigured()) {
    return { skipped: 'FIREFLIES_API_KEY is not set', groups: [], freshCount: 0, sent: 0 };
  }

  let groups: DigestGroup[];
  try {
    groups = await buildDigest();
  } catch (err) {
    console.error('[crm.digest] build failed:', err);
    return {
      skipped: `could not read Fireflies: ${err instanceof Error ? err.message : String(err)}`,
      groups: [],
      freshCount: 0,
      sent: 0,
    };
  }

  const freshCount = groups.reduce((n, g) => n + g.fresh.length, 0);
  if (freshCount === 0) {
    // Silence means nothing new, which is what makes the email worth opening when it comes.
    return { skipped: 'nobody new', groups, freshCount: 0, sent: 0 };
  }

  /**
   * WHO GETS IT: the Polynize notify list, which is the only list that exists and is the
   * people who asked to hear about the CRM. One digest covering every CRM rather than five
   * emails, with each person's CRM named against them.
   */
  const to: string[] = (await getNotifyMap().catch((): NotifyMap => ({})))['polynize'] ?? [];
  if (to.length === 0) {
    return { skipped: 'nobody on the Polynize notify list', groups, freshCount, sent: 0 };
  }

  const origin = consoleOrigin();
  const noun = freshCount === 1 ? 'person' : 'people';

  const textBody = [
    `${freshCount} new ${noun} to review from your meetings.`,
    '',
    ...groups.flatMap((g) => [
      `${g.label} (${g.fresh.length} new of ${g.total} waiting)`,
      ...g.fresh.map((c) => `  ${c.email} - from "${c.meetingTitle}"`),
      `  Review: ${origin}/console/leads/${g.owner}`,
      '',
    ]),
    'Nothing has been added. Tick the ones that are real.',
  ].join('\n');

  const htmlBody = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1f2a26">
<p style="font-size:17px;margin:0 0 16px"><strong>${freshCount} new ${noun}</strong> to review from your meetings.</p>
${groups
  .map(
    (g) => `<div style="margin:0 0 20px">
<p style="margin:0 0 6px;font-weight:600">${escapeHtml(g.label)} <span style="color:#6f7a72;font-weight:400">(${g.fresh.length} new of ${g.total} waiting)</span></p>
<ul style="margin:0 0 8px;padding-left:20px">
${g.fresh
  .map(
    (c) =>
      `<li style="margin-bottom:4px">${escapeHtml(c.email)} <span style="color:#6f7a72">from &ldquo;${escapeHtml(c.meetingTitle)}&rdquo;</span></li>`
  )
  .join('')}
</ul>
<a href="${escapeHtml(`${origin}/console/leads/${g.owner}`)}" style="background:#0f7d61;color:#fff;text-decoration:none;padding:9px 15px;border-radius:8px;display:inline-block;font-size:14px">Review ${escapeHtml(g.label)}</a>
</div>`
  )
  .join('')}
<p style="margin:16px 0 0;color:#6f7a72;font-size:13px">Nothing has been added. Tick the ones that are real.</p>
</div>`;

  // One email per recipient, so the notify list is not leaked to everyone on it.
  const results = await Promise.allSettled(
    to.map((addr) =>
      sendEmail({
        to: addr,
        subject: `${freshCount} new ${noun} to review`,
        html: htmlBody,
        text: textBody,
      })
    )
  );
  const sent = results.filter((r) => r.status === 'fulfilled' && r.value.status !== 'skipped').length;
  for (const r of results) {
    if (r.status === 'rejected') console.error('[crm.digest] a send failed:', r.reason);
  }

  /**
   * Only record the addresses once something actually went out. If every send failed, they
   * stay unmentioned and tomorrow tries again, rather than being marked as told and never
   * mentioned to anyone.
   */
  if (sent > 0) {
    for (const g of groups) {
      await addToEmailSet(
        DIGESTED,
        g.owner,
        g.fresh.map((c) => c.email)
      ).catch((err) => console.error(`[crm.digest] could not record ${g.owner}:`, err));
    }
  }

  return { groups, freshCount, sent };
}
