import type { BlueprintPayload } from '@/lib/blueprint/load';
import s from './blueprint.module.css';
import { BOOKING_URL, firstNameOf } from './util';
import { TrackedLink } from '@/app/_components/TrackedLink';
import { ResetLink } from '@/app/_components/ResetLink';

export function FinalCTA({ payload }: { payload: BlueprintPayload }) {
  const firstName = firstNameOf(payload.answers.name);
  return (
    <section className={s.final}>
      <h2 className={s.finalTitle}>
        Ready to build this, {firstName}<span className={s.mint}>?</span>
      </h2>
      <p className={s.finalLede}>
        A 30-minute call to walk you through the blueprint, sharpen the shape, and discuss the most
        effective way to unblock this bottleneck with an agentic team.
      </p>
      <div className={s.ctas}>
        <TrackedLink
          className={`${s.cta} ${s.ctaPrimary}`}
          href={BOOKING_URL}
          external
          event="booking_click"
          eventProps={{ surface: 'blueprint_final_cta' }}
        >
          book the call →
        </TrackedLink>
        <TrackedLink
          className={`${s.cta} ${s.ctaSecondary}`}
          href="/blueprint"
          event="cta_click"
          eventProps={{ surface: 'blueprint_final_cta', label: 'build_blueprint' }}
        >
          + build a new blueprint
        </TrackedLink>
      </div>
      <div className={s.finalReset}>
        <ResetLink
          className={s.resetLink}
          eventProps={{ surface: 'blueprint_final_cta', label: 'map_another_bottleneck' }}
        >
          + map another bottleneck
        </ResetLink>
      </div>
    </section>
  );
}
