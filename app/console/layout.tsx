import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUserEmail } from '@/lib/console-auth';
import { SignInGate } from './_components/SignInGate';
import { ThemeToggle } from './_components/ThemeToggle';
import { signOutAction } from './_actions';
import s from './_components/sign-in-gate.module.css';

export const metadata: Metadata = {
  title: 'Polynize Agentic Management Console',
  robots: { index: false, follow: false },
};

// Force request-time rendering for every route under /console. The layout
// reads cookies (via getCurrentUserEmail) to choose between SignInGate and
// the authenticated shell, AND SignInGate itself reads three flash cookies
// to switch between sign-in form and confirmation card. Without an explicit
// dynamic boundary on the LAYOUT (not just the page), Vercel's edge cache
// could hold the prior response across the post-action redirect — which
// surfaced as "cookies set, but read returns undefined" in the Step 7A.6
// confirmation-card-not-appearing bug.
export const dynamic = 'force-dynamic';

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const email = await getCurrentUserEmail();

  if (!email) {
    return <SignInGate />;
  }

  return (
    <div className={s.shell}>
      <nav className={s.topNav}>
        <Link href="/console/marketing" className={s.eyebrow}>PAM control centre</Link>
        <div className={s.userBlock}>
          <ThemeToggle />
          <span className={s.userEmail}>{email}</span>
          <form action={signOutAction}>
            <button type="submit" className={s.signOutBtn}>
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <main className={s.main}>{children}</main>
    </div>
  );
}
