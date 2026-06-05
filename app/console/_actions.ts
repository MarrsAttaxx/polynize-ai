'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  COOKIE_NAME,
  createMagicLinkToken,
  isEmailAllowed,
} from '@/lib/console-auth';
import { sendEmail } from '@/lib/resend-client';

const emailSchema = z.string().email();

/**
 * Send a magic-link email. PURE side effect: no cookies, no redirect, no
 * revalidate.
 *
 * The sign-in confirmation ("Check your inbox") is owned by client state in
 * SignInForm, NOT by a flash cookie read back after a redirect. That cookie
 * round-trip was the root cause of the recurring "confirmation only shows
 * after a hard refresh" bug: the cookie was set in the action and the browser
 * stored it (hence hard refresh worked), but the post-action redirect render
 * read the pre-submit cookie snapshot and re-rendered the form (the "flash").
 * Keeping this action free of cookies/redirect means the confirmation can show
 * synchronously on the client with no fragile server round-trip.
 *
 * Non-disclosure preserved: a well-formed but non-allowlisted email returns
 * { ok: true } with no send attempt, so the UI's confirmation never reveals
 * allowlist membership. { ok: false } is only a genuine delivery failure for
 * an allowed email, so the UI can show a soft note.
 */
export async function sendMagicLinkAction(
  email: string
): Promise<{ ok: boolean }> {
  const raw = String(email ?? '')
    .trim()
    .toLowerCase();

  if (!emailSchema.safeParse(raw).success) {
    // Malformed: nothing to send (the client validates format too). Treat as
    // a no-op success so it is not a disclosure vector.
    return { ok: true };
  }

  if (!isEmailAllowed(raw)) {
    return { ok: true }; // non-disclosure: do not reveal allowlist membership
  }

  try {
    const token = await createMagicLinkToken(raw);
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ?? 'https://pam.polynize.ai';
    const link = `${baseUrl}/console/auth/verify?token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: raw,
      subject: 'Sign in to Polynize Agentic Management Console',
      html: `<p>Click the link below to sign in to the Polynize Agentic Management Console (PAM):</p>
<p><a href="${link}">Sign in to Polynize Agentic Management Console</a></p>
<p>This link expires in 15 minutes.</p>
<p>If you did not request this, you can safely ignore this email.</p>`,
      text: `Sign in to the Polynize Agentic Management Console (PAM):

${link}

This link expires in 15 minutes.

If you did not request this, you can safely ignore this email.`,
    });
    return { ok: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[console-auth] failed to send magic link', err);
    return { ok: false };
  }
}

export async function signOutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  redirect('/console');
}
