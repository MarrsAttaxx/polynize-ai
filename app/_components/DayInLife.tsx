import type { CapabilityMapData } from '@/lib/types';
import { buildCapabilityTimeline } from '@/lib/blueprint/timeline';
import s from './day-in-life.module.css';

/**
 * The "Day in the Life" timeline body, shared by the public blueprint
 * (/blueprints/[id] Day section) and the /agents Phase B reveal so both render
 * identically. Renders the data-driven timeline of agent/you messages plus the
 * closing "the shift" note. Section heading/lede are supplied by each caller
 * (the surfaces frame it differently), this is just the body.
 */
export function DayInLife({
  data,
  firstName,
}: {
  data: CapabilityMapData;
  firstName: string;
}) {
  const timeline = buildCapabilityTimeline(data, firstName);

  return (
    <>
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
                  return (
                    <div key={i} className={s.tlMsg}>
                      <div className={s.tlAv} title={m.agent.name}>
                        {m.agent.name[0]}
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
        <div className={s.dayCloseEyebrow}>§ the shift</div>
        <p>
          You weren&apos;t in every decision. But every decision that mattered came to you with the
          context already gathered, drafted, and caveated. That&apos;s the difference between a team
          of humans and a Cognitive Work Unit.
        </p>
      </div>
    </>
  );
}
