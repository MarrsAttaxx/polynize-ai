import { cookies } from 'next/headers';
import { SignInForm } from './SignInForm';

/**
 * Server wrapper for the sign-in UI. Its only server-side read is the
 * `console_signin_error` flash cookie, which the verify route (app/console/
 * auth/verify/route.ts) sets via a real HTTP redirect when a clicked sign-in
 * link is invalid or expired. That path is an ordinary GET navigation, so the
 * browser sends the cookie and this read is reliable.
 *
 * The SUBMIT confirmation ("Check your inbox") is deliberately NOT read from a
 * cookie here. It lives in SignInForm's client state, set synchronously on
 * submit. That is the root-cause fix for the recurring "confirmation only
 * appears after a hard refresh" bug: a cookie set inside a Server Action that
 * then redirect()s was not observed by the immediate post-action render.
 */
export async function SignInGate() {
  const jar = await cookies();
  const error = jar.get('console_signin_error')?.value;
  return <SignInForm initialError={error} />;
}
