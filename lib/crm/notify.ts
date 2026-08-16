import { sendEmail } from '@/lib/resend-client';
import { getNotifyMap } from './notify-store';
import { streamLabel } from '@/lib/marketing/streams';
import { blueprintUrl } from './model';

/**
 * The new-lead ping.
 *
 * Marrs: "if a new lead comes in on Polynize, Shourov and I get pinged on email... so
 * they have a direct link back to the CRM."
 *
 * BEST EFFORT BY CONTRACT. This never throws. A lead that saved but could not be
 * announced is a small problem; a lead lost because the announcement failed is the whole
 * funnel. Every caller is expected to `void` this or await it inside its own try.
 */

export type LeadPing = {
  owner: string;
  email: string;
  name?: string;
  business?: string;
  /** The blueprint they generated, if they came through the website funnel. */
  blueprintId?: string;
};

/**
 * The console's own origin, for the link back.
 *
 * From an env var and not from a request, because this is called from a server route that
 * may be handling a request to polynize.ai rather than to the console: the request host
 * would build a link to the wrong site. Falls back to the production console so a missing
 * variable degrades to a correct-but-hardcoded link rather than a broken relative one.
 */
function consoleOrigin(): string {
  const raw = process.env.PAM_CONSOLE_ORIGIN?.trim();
  if (raw) return raw.replace(/\/+$/, '');
  return 'https://pam.polynize.ai';
}

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Tell whoever is on the list that a lead arrived.
 *
 * Returns what happened, purely so callers can log it. Never throws.
 */
export async function pingNewLead(
  lead: LeadPing
): Promise<{ sent: number; skipped: string | null }> {
  try {
    const map = await getNotifyMap();
    const to = map[lead.owner] ?? [];
    if (to.length === 0) {
      // Not an error. Nobody has asked to be told about this stream yet.
      return { sent: 0, skipped: 'nobody on the list' };
    }

    const who = lead.name?.trim() || lead.email;
    const where = streamLabel(lead.owner);
    const origin = consoleOrigin();
    const crmUrl = `${origin}/console/leads/${lead.owner}`;

    // No em-dashes: house rule, and this is user-facing copy.
    const lines = [
      `${who} just came in through ${where}.`,
      '',
      `Email: ${lead.email}`,
      lead.business?.trim() ? `Company: ${lead.business.trim()}` : null,
      '',
      `Open the CRM: ${crmUrl}`,
      lead.blueprintId ? `Their blueprint: ${blueprintUrl(lead.blueprintId, origin)}` : null,
      '',
      'They are sitting at New until someone moves them.',
    ].filter((x): x is string => x !== null);

    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1f2a26">
<p style="font-size:17px;margin:0 0 14px"><strong>${escapeHtml(who)}</strong> just came in through ${escapeHtml(where)}.</p>
<p style="margin:0 0 6px">Email: <a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></p>
${lead.business?.trim() ? `<p style="margin:0 0 6px">Company: ${escapeHtml(lead.business.trim())}</p>` : ''}
<p style="margin:18px 0"><a href="${escapeHtml(crmUrl)}" style="background:#0f7d61;color:#fff;text-decoration:none;padding:11px 18px;border-radius:9px;display:inline-block">Open the CRM</a></p>
${lead.blueprintId ? `<p style="margin:18px 0 0"><a href="${escapeHtml(blueprintUrl(lead.blueprintId, origin))}" style="color:#0f7d61;font-weight:600">See the capability blueprint they built &rarr;</a></p>` : ''}
<p style="margin:16px 0 0;color:#6f7a72;font-size:13px">They are sitting at New until someone moves them.</p>
</div>`;

    /**
     * ONE EMAIL PER RECIPIENT, not one email to all of them.
     *
     * A shared To: line leaks the whole notify list to everyone on it, and replies land
     * on people who did not ask for them. Sent in parallel; one failing address does not
     * stop the others, which is why these are settled rather than awaited in sequence.
     */
     const results = await Promise.allSettled(
      to.map((addr) =>
        sendEmail({
          to: addr,
          subject: `New ${where} lead: ${who}`,
          html,
          text: lines.join('\n'),
        })
      )
    );

    const sent = results.filter(
      (r) => r.status === 'fulfilled' && r.value.status !== 'skipped'
    ).length;
    for (const r of results) {
      if (r.status === 'rejected') console.error('[crm-notify] one send failed:', r.reason);
    }
    return { sent, skipped: sent === 0 ? 'every send failed or was disabled' : null };
  } catch (err) {
    console.error('[crm-notify] ping failed entirely:', err);
    return { sent: 0, skipped: 'threw' };
  }
}
