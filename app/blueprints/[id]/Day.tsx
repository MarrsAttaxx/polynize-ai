import type { BlueprintPayload } from '@/lib/blueprint/load';
import s from './blueprint.module.css';
import { firstNameOf } from './util';
import { DayInLife } from '@/app/_components/DayInLife';

export function Day({ payload }: { payload: BlueprintPayload }) {
  const { answers, data } = payload;
  const firstName = firstNameOf(answers.name, 'you');
  const company = (answers.company ?? '').trim() || 'your business';

  return (
    <section className={s.page} data-screen-label="Page 04 · Day in the Life">
      <div className={s.pageHead}>
        <div className={s.pageNum}>03 / 03</div>
        <div className={s.eyebrow}>§ a day in the life</div>
        <h2 className={s.pageTitle}>
          What a Tuesday
          <br />
          actually looks like<span className={s.mint}>.</span>
        </h2>
        <p className={s.pageLede}>
          Based on the bottleneck you described at {company}, here&apos;s a lightly fictionalised
          walk-through of a typical day with the team in place. The point isn&apos;t the specifics.
          It&apos;s the rhythm. You show up, you make decisions, the execution happens around you.
        </p>
      </div>

      <DayInLife data={data} firstName={firstName} />
    </section>
  );
}
