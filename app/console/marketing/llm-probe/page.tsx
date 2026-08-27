/**
 * THE APRIL PROBE (D71). Three calls, one page, and it says which key is broken.
 *
 * Marrs: "April is not working." Then, after the errors were made honest, "Its not creits."
 *
 * Vercel's runtime logs return 403 for this team, so the only way to see a provider error from here
 * is to make the call and print it. This does, with both keys, because April uses its OWN key
 * (`APRIL_OPENROUTER_API_KEY`) and everything else falls back to the console's, which means April
 * can be dead while nothing else in the console notices.
 *
 * It spends three tiny completions, which is fractions of a cent, and it prints no key.
 *
 * Team scope only, and not linked from anywhere: a diagnostic reached by url.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import { runLlmProbe } from '@/lib/llm/probe';
import s from '../metricool/probe/probe.module.css';

export const dynamic = 'force-dynamic';
/** Three sequential completions against a reasoning model. */
export const maxDuration = 300;

export default async function LlmProbePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') redirect(`/console/${user.scope.slug}/blueprint`);

  const p = await runLlmProbe();
  const april = p.calls[0];
  const consoleCall = p.calls[1];

  /**
   * The conclusion, computed rather than left to the reader. The whole point of the page is that
   * the two keys behaving differently IS the answer, and it should not need spotting.
   */
  const verdict =
    april.ok && consoleCall.ok
      ? 'Both keys work. The outage is not the key: check the low-ceiling call below, and if that answered too then April was failing for another reason and may already be back.'
      : !april.ok && consoleCall.ok
        ? "APRIL'S KEY IS THE PROBLEM. The console's key works and April's does not, which is exactly why nothing else complained. Replace APRIL_OPENROUTER_API_KEY in Vercel."
        : april.ok && !consoleCall.ok
          ? "The console's key is broken and April's works. April should be fine; whatever else uses the fallback is not. Replace OPENROUTER_API_KEY in Vercel."
          : 'Both keys fail the same way, so it is the account or the model rather than one key. Read the error under the first call.';

  const bad = !april.ok || !consoleCall.ok;

  return (
    <div className={s.root}>
      <BackLink fallbackHref="/console/marketing" className={s.back} />
      <span className={s.eyebrow}>diagnostic · spends three tiny calls</span>
      <h1 className={s.title}>April probe</h1>
      <p className={s.sub}>
        provider {p.provider} · model {p.model} · reload to run it again
      </p>

      <section className={s.answer}>
        <h2 className={s.aTitle}>The answer</h2>
        <p className={bad ? s.bad : s.good}>{verdict}</p>
      </section>

      <section className={s.answer}>
        <h2 className={s.aTitle}>Which keys are set</h2>
        <pre className={s.pre}>
          {p.keys
            .map((k) => `${k.set ? 'set  ' : 'UNSET'}  ${k.name}  (${k.length} chars)`)
            .join('\n')}
          {'\n'}
          {p.keysDiffer
            ? 'The two keys are DIFFERENT values, so they can fail independently.'
            : 'The two keys are the same value, or only one is set, so April uses the same credentials as everything else.'}
        </pre>
        <p className={s.note}>
          Lengths only, never the keys. A truncated paste is a real cause and the length is the safe
          way to see it: an OpenRouter key is normally in the 60s or 70s of characters.
        </p>
      </section>

      <div className={s.calls}>
        {p.calls.map((c) => (
          <div key={c.label} className={s.call}>
            <div className={s.callHead}>
              <code className={s.callPath}>{c.label}</code>
              <span className={`${s.status} ${c.ok ? s.stOk : s.stBad}`}>
                {c.ok ? 'answered' : 'failed'}
              </span>
              <span className={s.ctype}>{c.ms}ms</span>
            </div>
            <p className={s.note}>{c.why}</p>
            {c.ok ? (
              <pre className={s.pre}>{c.reply}</pre>
            ) : (
              <>
                <p className={s.bad}>{c.error}</p>
                <pre className={s.pre}>{c.raw}</pre>
              </>
            )}
          </div>
        ))}
      </div>

      <p className={s.foot}>Send me this page and I will fix the thing it names.</p>
    </div>
  );
}
