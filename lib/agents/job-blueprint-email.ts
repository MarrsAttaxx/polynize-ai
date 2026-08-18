import { sendEmail } from '@/lib/resend-client';
import type { JobBlueprint } from './job-blueprint-schema';

/**
 * The delivery email for a job blueprint.
 *
 * Deliberately short. The email is a doorway, not the document: everything worth reading is
 * behind the link, and a long email competes with the thing it is trying to get opened. It
 * carries one number the reader will actually check (how many capabilities were found) and
 * the exposure read, because those are the two things that decide whether they click.
 *
 * Plain text is sent alongside the HTML rather than left to Resend to synthesise, so the
 * text version reads like something a person wrote.
 */

const LANE_WORD = { human: 'human', hybrid: 'hybrid', agent: 'agentic' } as const;

export async function sendJobBlueprintEmail(args: {
  to: string;
  name?: string;
  id: string;
  blueprint: JobBlueprint;
  baseUrl: string;
}) {
  const { to, name, id, blueprint, baseUrl } = args;
  const url = `${baseUrl}/job-mapping/${id}`;
  const first = (name ?? '').trim().split(/\s+/)[0];
  const hello = first ? `Hi ${first},` : 'Hi,';

  const counts = blueprint.capabilities.reduce(
    (acc, c) => ({ ...acc, [c.allocation]: (acc[c.allocation] ?? 0) + 1 }),
    {} as Record<string, number>
  );
  const split = (['human', 'hybrid', 'agent'] as const)
    .map((lane) => `${counts[lane] ?? 0} ${LANE_WORD[lane]}`)
    .join(', ');

  const subject = `Your job map: ${blueprint.role_title}`;

  const text = `${hello}

Your capability map for ${blueprint.role_title} is ready.

${blueprint.capabilities.length} capabilities, split ${split}.
Exposure: ${blueprint.exposure.level}. ${blueprint.exposure.line}

Read it here: ${url}

The map is yours to keep and to share. We did not keep your job description.

Polynize`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:36px 24px;color:#c7b9ac;">
    <div style="font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:#69fccb;margin-bottom:22px;">Polynize</div>
    <p style="font-size:16px;line-height:1.6;color:#f4ece4;margin:0 0 16px;">${hello}</p>
    <p style="font-size:16px;line-height:1.6;color:#f4ece4;margin:0 0 22px;">
      Your capability map for <strong>${escapeHtml(blueprint.role_title)}</strong> is ready.
    </p>
    <div style="border:1px solid rgba(105,252,203,0.18);border-radius:10px;padding:16px 18px;margin:0 0 24px;">
      <div style="font-size:14px;line-height:1.6;">
        <strong style="color:#f4ece4;">${blueprint.capabilities.length} capabilities</strong>, split ${escapeHtml(split)}.
      </div>
      <div style="font-size:14px;line-height:1.6;margin-top:8px;">
        Exposure: <strong style="color:#f4ece4;">${blueprint.exposure.level}</strong>. ${escapeHtml(blueprint.exposure.line)}
      </div>
    </div>
    <a href="${url}" style="display:inline-block;background:#69fccb;color:#0a0a0f;font-weight:700;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:999px;">Read your job map</a>
    <p style="font-size:13px;line-height:1.6;color:#8a7d72;margin:26px 0 0;">
      The map is yours to keep and to share. We did not keep your job description.
    </p>
  </div>
</body></html>`;

  return sendEmail({ to, subject, html, text });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
