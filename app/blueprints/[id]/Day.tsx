import type { BlueprintPayload } from '@/lib/blueprint/load';
import { buildCapabilityTimeline } from '@/lib/blueprint/timeline';
import s from './blueprint.module.css';
import { firstNameOf } from './util';

export function Day({ payload }: { payload: BlueprintPayload }) {
  const { answers, data } = payload;
  const firstName = firstNameOf(answers.name, 'you');
  const company = (answers.company ?? '').trim() || 'your business';
  const timeline = buildCapabilityTimeline(data, firstName);

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

      <div className={s.timeline}>
        {timeline.map((block, bi) => (
          <div key={bi} className={s.tlBlock}>
            <div className={s.tlTime}>
              <div className={s.tlHour}>{block.time}</div>
              <div className={s.tlLabel}>{block.label}</div>
            </div>
            <div className={s.tlMessages}>
              {block.items.map((m, i) => {
                if (m.from === 'agent') {
                  const initial = m.agent.name[0];
                  return (
                    <div key={i} className={s.tlMsg}>
                      <div className={s.tlAv} title={m.agent.name}>
                        {initial}
                      </div>
                      <div className={s.tlBubble}>
                        <div className={s.tlFrom}>
                          {m.agent.name} · {m.agent.role}
                        </div>
                        <div className={s.tlText}>{m.text}</div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={i} className={`${s.tlMsg} ${s.tlMsgUser}`}>
                    <div className={`${s.tlBubble} ${s.tlBubbleHuman}`}>
                      <div className={s.tlFrom}>{firstName} (you)</div>
                      <div className={s.tlText}>{m.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className={s.dayClose}>
        <div className={s.eyebrow}>§ the shift</div>
        <p>
          You weren&apos;t in every decision. But every decision that mattered came to you with the
          context already gathered, drafted, and caveated. That&apos;s the difference between a team
          of humans and a Cognitive Work Unit.
        </p>
      </div>
    </section>
  );
}
