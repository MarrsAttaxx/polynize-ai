import type { Metadata } from 'next';
import { BRAND_TOKENS } from '@/lib/brand/tokens';
import { DraftingGrid } from '@/app/_components/DraftingGrid';
import s from './brand.module.css';

export const metadata: Metadata = {
  title: 'Brand · polynize.ai',
  description:
    'The polynize.ai brand system, v2.0. Positioning, narrative, voice, colour tokens, the Tactile depth system, and component recipes. Polynize maps the work, finds the human at its centre, and builds the hybrid team that amplifies them. Structured for humans to read and agents to parse.',
  robots: { index: false, follow: false },
};

const ANCHORS: { id: string; label: string }[] = [
  { id: 'positioning', label: '01 positioning' },
  { id: 'narrative', label: '02 narrative' },
  { id: 'voice', label: '03 voice' },
  { id: 'rules', label: '04 rules' },
  { id: 'typography', label: '05 type' },
  { id: 'tokens', label: '06 tokens' },
  { id: 'allocation', label: '07 allocation' },
  { id: 'tactile', label: '08 tactile' },
  { id: 'components', label: '09 components' },
  { id: 'antipatterns', label: '10 anti-patterns' },
  { id: 'machine', label: '11 for agents' },
];

export default function BrandPage() {
  const t = BRAND_TOKENS;
  const jsonHtml = colorize(JSON.stringify(t, null, 2));
  const todayLabel = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
    <DraftingGrid />
    <div className={s.root}>
      {/* Machine-readable payload for AI consumers */}
      <script
        type="application/json"
        id="brand-tokens"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t) }}
      />

      <header className={s.top}>
        <div className={s.brand}>
          <a href="/">polynize</a>
          <span className={s.brandSlash}>/</span>
          <span>brand</span>
        </div>
        <div className={s.anchors}>
          {ANCHORS.map((a) => (
            <a key={a.id} href={`#${a.id}`}>{a.label}</a>
          ))}
        </div>
      </header>

      <main className={s.main}>
        {/* ---- Hero ---- */}
        <section className={s.hero}>
          <div className={s.kicker}>§ brand / v{t.version} / polynize.ai</div>
          <h1 className={s.h1}>
            Brand<span className={s.mint}>.</span>
          </h1>
          <p className={s.lede}>
            The visual and verbal system for polynize.ai. Structured for humans to read and for
            agents to parse. Every token, rule, and decision on one page. If you are an LLM reading
            this, the machine-readable payload is in the{' '}
            <code>#brand-tokens</code> JSON script block.
          </p>
        </section>

        {/* ---- §01 Positioning ---- */}
        <section className={s.sec} id="positioning">
          <SecHead n="01" title="Positioning" sub="What Polynize is, who it serves, what it sells, and why the thinking is the moat." />
          <SecBody>
            <h3>What we are</h3>
            <p>
              Polynize is the work-design company for the agent era. We blueprint and build agent
              teams. We reorganise how a business works, then build the hybrid human-agent team that
              runs it. The thinking is the product. The agents are the output.
            </p>
            <h3>Who we serve</h3>
            <p>
              <strong>The Scaling Operator.</strong> Owners, operators, and CEOs of established
              medium-to-large businesses. We sell to the leadership layer as a partner, not as a
              consulting replacement and not as another vendor.
            </p>
            <p>
              <strong>Wrong visitor:</strong> someone who wants to cut their team. The filter line is
              plain. If you are trying to replace your people, Polynize does not make sense for you.
              We build the team around the human and never cut them out.
            </p>
            <h3>What we sell</h3>
            <p>
              The shift, not the tool. The entry product is the{' '}
              <strong>capability blueprint</strong>: we map your business, show you the bottleneck,
              and hand you the design of the team that solves it. Training, transformation, and
              deployment all bind to that one analysis.
            </p>
            <h3>The moat</h3>
            <p>Three things, and never all three in one place elsewhere.</p>
            <p>
              <strong>Capability mapping with depth.</strong> Break the work into capabilities, label
              each one human, hybrid, or agent, benchmark what good looks like, measure the gap, and
              design the team. The benchmark and the team shape are the unique outputs.
            </p>
            <p>
              <strong>Human-first team design.</strong> We build the team around the human and never
              cut them out.
            </p>
            <p>
              <strong>A training product.</strong> We train the human first, then the agents.
            </p>
            <h3>Why tool-agnostic is the moat</h3>
            <p>
              We do not win at the technology layer. On scale, capital, and distribution the
              platforms win. We win on the thinking: the blueprint, the team design, and the human
              training, which travel across any model or any platform. That is why we can stand on
              any stage and stay relevant.
            </p>
            <h3>Brand lines</h3>
            <p>
              <strong>Think better</strong> is the method line. <strong>Work worth doing</strong> is
              the payoff line. The ladder reads: think better, build the team around the human, work
              worth doing. One line: Polynize maps the work, finds the human at its centre, and
              builds the hybrid team that amplifies them.
            </p>
          </SecBody>
        </section>

        {/* ---- §02 Narrative ---- */}
        <section className={s.sec} id="narrative">
          <SecHead n="02" title="Narrative spine" sub="Three ideas. Every piece of copy laddered back to these." />
          <SecBody>
            <h3>One. Execution is no longer the constraint.</h3>
            <p>
              AI made execution cheap. Judgment, direction, and alignment are now the scarce things.
              The question is no longer how to get more work done. It is how to get more of the right
              work done, without being in every decision.
            </p>
            <h3>Two. You cannot redesign what you cannot see.</h3>
            <p>
              The capability blueprint is the recognition step before any team is built. It shows
              which work is human, which is hybrid, and which is agent, and it benchmarks what good
              looks like. It is the moment a client sees the shape of the fix, and it is where they
              decide to sign.
            </p>
            <h3>Three. The unit of work is one human, amplified.</h3>
            <p>
              One human at the centre holds judgment. One agent lead runs the team. Three to four
              agents around the lead hold execution. The agent lead is load-bearing: the human
              directs the lead, the lead runs the rest. Roughly 1 human + 4 agents = 5× throughput.
              Read it as amplification of one human, never output from fewer staff.
            </p>
            <p>
              The unit is the <strong>Cognitive Work Unit (CWU)</strong>. It is not one fixed shape.
              It composes into different configurations depending on the work. The shape library is
              in development and not yet final.
            </p>
          </SecBody>
        </section>

        {/* ---- §03 Voice ---- */}
        <section className={s.sec} id="voice">
          <SecHead n="03" title="Voice & tone" sub="Direct, business-literate. Short sentences. No hype. Operator-to-operator." />
          <SecBody>
            <h3>Word choice</h3>
            <div className={s.twoCol}>
              <div className={s.list}>
                <div className={`${s.listHead} ${s.listHeadUse}`}>› use</div>
                <ul>
                  {t.voice.prefer_words.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
              <div className={s.list}>
                <div className={`${s.listHead} ${s.listHeadAvoid}`}>× avoid</div>
                <ul>
                  {t.voice.avoid_words.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
            </div>
          </SecBody>
        </section>

        {/* ---- §04 Writing rules ---- */}
        <section className={s.sec} id="rules">
          <SecHead n="04" title="Writing rules" sub="Hard rules. No exceptions, including in AI-generated content." />
          <SecBody>
            <div className={s.rules}>
              {t.writing_rules.map((r) => (
                <div key={r.id} className={s.rule}>
                  <span className={s.ruleNum}>{r.id}</span>
                  <p className={s.ruleText}>
                    {r.rule}
                    <em className={s.ruleWhy}>{r.why}</em>
                  </p>
                </div>
              ))}
            </div>
          </SecBody>
        </section>

        {/* ---- §05 Typography ---- */}
        <section className={s.sec} id="typography">
          <SecHead n="05" title="Typography" sub="Two families plus a mono, plus Caveat for the rare accent." />
          <SecBody>
            <div className={s.specimen}>
              <div className={s.specimenLabel}>Space Grotesk · Display · 400 / 500 / 600 / 700</div>
              <p className={s.specimenDisplay}>
                One human.
                <br />
                Five agents.
              </p>
            </div>
            <div className={s.specimen}>
              <div className={s.specimenLabel}>Inter · Body · 400 / 500 / 600</div>
              <p className={s.specimenBody}>
                Polynize is the work-design company for the agent era. We blueprint and build the
                hybrid human-agent team that runs the work. Operator-to-operator voice. No hype.
              </p>
            </div>
            <div className={s.specimen}>
              <div className={s.specimenLabel}>JetBrains Mono · Chrome &amp; labels · 400 / 500</div>
              <p className={s.specimenMono}>
                § 07 / shape_02 · pipeline_and_conversion
                <br />
                alloc: {'{ human: 38%, hybrid: 25%, agent: 37% }'}
              </p>
            </div>
          </SecBody>
        </section>

        {/* ---- §06 Tokens ---- */}
        <section className={s.sec} id="tokens">
          <SecHead n="06" title="Colour tokens" sub={`Base palette. Also available as JSON at #brand-tokens.`} />
          <SecBody>
            <h3>Surfaces &amp; text</h3>
            <div className={s.swatches}>
              <Swatch name="--bg" hex={t.palette.bg} role="page background" />
              <Swatch name="--surface" hex={t.palette.surface} role="card, panel" />
              <Swatch name="--surface-2" hex={t.palette.surface_2} role="lifted card" />
              <Swatch name="--text" hex={t.palette.text} role="primary text" dark />
              <Swatch name="--text-2" hex={t.palette.text_2} role="secondary" dark />
              <Swatch name="--text-3" hex={t.palette.text_3} role="muted" dark />
            </div>
            <h3>Accents</h3>
            <div className={s.swatches}>
              <Swatch name="--mint" hex={t.palette.mint} role="primary accent, CTA, agent" dark />
              <Swatch name="--blue" hex={t.palette.blue} role="supporting accent" dark />
              <Swatch name="--gold" hex={t.palette.gold} role="numbers, data" dark />
              <Swatch name="--amber" hex={t.palette.amber} role="hybrid allocation" dark />
              <Swatch name="--coral" hex={t.palette.coral} role="human allocation" dark />
            </div>
          </SecBody>
        </section>

        {/* ---- §07 Allocation ---- */}
        <section className={s.sec} id="allocation">
          <SecHead n="07" title="Allocation palette" sub="The three-colour system used in every Heat Map. Do not remap." />
          <SecBody>
            <div className={s.alloc}>
              <div className={`${s.allocCard} ${s.allocCardHuman}`}>
                <div className={s.allocName} style={{ color: t.palette.coral }}>
                  human-led
                </div>
                <p className={s.allocWhat}>
                  Requires trust, accountability, live decisions, or high failure cost. Live client
                  conversations, final judgment calls, commitment moments.
                </p>
                <div className={s.allocHex} style={{ color: t.palette.coral }}>
                  {t.palette.coral}
                </div>
              </div>
              <div className={`${s.allocCard} ${s.allocCardHybrid}`}>
                <div className={s.allocName} style={{ color: t.palette.amber }}>
                  hybrid / CWU
                </div>
                <p className={s.allocWhat}>
                  Needs human direction, agents can execute within it. Proposal drafting, content
                  creation, briefing, review.
                </p>
                <div className={s.allocHex} style={{ color: t.palette.amber }}>
                  {t.palette.amber}
                </div>
              </div>
              <div className={`${s.allocCard} ${s.allocCardAgent}`}>
                <div className={s.allocName} style={{ color: t.palette.mint }}>
                  agent-executable
                </div>
                <p className={s.allocWhat}>
                  Structured, repeatable, pattern-based. Research, scheduling, monitoring,
                  coordination, follow-through.
                </p>
                <div className={s.allocHex} style={{ color: t.palette.mint }}>
                  {t.palette.mint}
                </div>
              </div>
            </div>
            <div className={s.flag}>
              <strong>Known divergence.</strong> polynize.ai website uses{' '}
              <code>#ff7a6b</code> (coral) and <code>#f0b86b</code> (amber). Agent Team Console app
              uses <code>#e86a5c</code> (human) and <code>#e8b85c</code> (hybrid). Both resolve to
              the same semantic. Reconciliation pending. Until then, do not cross the palettes
              between surfaces.
            </div>
          </SecBody>
        </section>

        {/* ---- §08 Tactile ---- */}
        <section className={s.sec} id="tactile">
          <SecHead
            n="08"
            title="Tactile · depth extension"
            sub="Layers on top of base tokens. Replaces flat 1px borders with carved shadows. Three elevations. Light source invariant: upper-left highlight, lower-right shadow."
          />
          <SecBody>
            <h3>Substrate swatches (dark)</h3>
            <div className={s.swatches}>
              <Swatch name="--tac-bg" hex={t.tactile.substrate_dark.tac_bg} role="page bg, warm navy" />
              <Swatch name="--tac-surface" hex={t.tactile.substrate_dark.tac_surface} role="raised elev 1" />
              <Swatch name="--tac-surface-2" hex={t.tactile.substrate_dark.tac_surface_2} role="emphasised elev 2" />
              <Swatch name="--tac-inset" hex={t.tactile.substrate_dark.tac_inset} role="recessed well" />
            </div>

            <h3>Three elevations</h3>
            <div className={s.elevations}>
              <div className={`${s.elev} ${s.elevInset}`}>
                <span className={s.elevTag}>inset (-1)</span>
                <p className={s.elevDesc}>Wells, input tracks, channels. Editable → recessed.</p>
              </div>
              <div className={`${s.elev} ${s.elevRaised}`}>
                <span className={s.elevTag}>raised (+1)</span>
                <p className={s.elevDesc}>Cards, panels, buttons. Interactive → raised.</p>
              </div>
              <div className={`${s.elev} ${s.elevEmphasised}`}>
                <span className={s.elevTag}>emphasised (+2)</span>
                <p className={s.elevDesc}>Hero stats, featured cards. Use sparingly.</p>
              </div>
            </div>

            <h3>The five-layer shadow recipe</h3>
            <div className={s.jsonCard}>
              <pre>{`box-shadow:
  0 1px 0   var(--tac-edge-light) inset,   /* 1. top highlight */
  0 -1px 0  var(--tac-edge-dark)  inset,   /* 2. bottom shadow */
  -6px -6px 14px var(--tac-rim),           /* 3. upper-left rim */
  8px  8px  20px rgba(0,0,0,0.40),         /* 4. main cast */
  14px 14px 36px rgba(0,0,0,0.25);         /* 5. far ambient */`}</pre>
            </div>

            <h3>Radii &amp; motion</h3>
            <p>
              Cards <code>18px</code>, buttons <code>12px</code>, inputs <code>12px</code>,
              pills <code>999px</code>. Transitions <code>120ms ease-out</code>. Hover{' '}
              <code>translate(-1px, -1px)</code>, pressed <code>translate(0, 1px)</code>. No scale,
              no bounce.
            </p>

            <h3>Texture</h3>
            <p>
              Two noise layers, both inline SVG (~1KB total). Body-level felt on{' '}
              <code>body::before</code> at opacity 0.22, blended <code>overlay</code>. Card-level
              brushed metal on each card&apos;s <code>::after</code> at opacity 0.18. Do not
              substitute PNGs; the blend-mode interaction with accent colours is what keeps surfaces
              from reading plastic.
            </p>
          </SecBody>
        </section>

        {/* ---- §09 Components ---- */}
        <section className={s.sec} id="components">
          <SecHead
            n="09"
            title="Component recipes"
            sub="Each tile is itself a live example of the recipe it documents."
          />
          <SecBody>
            <div className={s.componentGrid}>
              <div className={s.componentTile}>
                <span className={s.componentLabel}>primary button</span>
                <div className={s.componentDemo}>
                  <button type="button" className={s.demoBtnPrimary}>
                    <span style={{ marginRight: 10, opacity: 0.6 }}>→</span>map_your_business
                  </button>
                </div>
                <p className={s.componentNote}>
                  Mint gradient fill, bevel highlight, mint ambient glow. Pressed state sinks 1px,
                  inverts the shadow into an inset.
                </p>
              </div>

              <div className={s.componentTile}>
                <span className={s.componentLabel}>secondary button</span>
                <div className={s.componentDemo}>
                  <button type="button" className={s.demoBtnSecondary}>
                    learn more
                  </button>
                </div>
                <p className={s.componentNote}>
                  Raised chicklet on <code>--tac-surface</code>. No border. Three-layer shadow.
                </p>
              </div>

              <div className={s.componentTile}>
                <span className={s.componentLabel}>input / textarea</span>
                <div className={s.componentDemo}>
                  <input
                    type="text"
                    className={s.demoInput}
                    placeholder="recessed well, carved into the page"
                    readOnly
                  />
                </div>
                <p className={s.componentNote}>
                  Recessed well on <code>--tac-inset</code>. Focus ring sits outside the well
                  (2px <code>--mint</code>).
                </p>
              </div>

              <div className={s.componentTile}>
                <span className={s.componentLabel}>progress / stat bar</span>
                <div className={s.componentDemo}>
                  <div className={s.demoProgress}>
                    <div className={s.demoProgressFill} />
                  </div>
                </div>
                <p className={s.componentNote}>
                  Carved track with a raised gradient fill. Fill has its own bevel highlight + mint
                  glow so it reads as polished lit material.
                </p>
              </div>

              <div className={s.componentTile}>
                <span className={s.componentLabel}>pills / chips</span>
                <div className={s.componentDemo}>
                  <div className={s.demoChipRow}>
                    <span className={s.demoChip}>operator</span>
                    <span className={s.demoChip}>owner</span>
                    <span className={s.demoChip}>CEO</span>
                  </div>
                </div>
                <p className={s.componentNote}>
                  Raised chicklets for selectable chips. Active state adds a 2px mint ring and
                  mint ambient glow.
                </p>
              </div>

              <div className={s.componentTile}>
                <span className={s.componentLabel}>avatars</span>
                <div className={s.componentDemo}>
                  <div className={s.demoAvatarRow}>
                    <div className={s.demoAvatar}>M</div>
                    <div className={`${s.demoAvatar} ${s.demoAvatarInset}`}>A</div>
                    <div className={`${s.demoAvatar} ${s.demoAvatarInset}`}>N</div>
                  </div>
                </div>
                <p className={s.componentNote}>
                  Primary (gradient raised) for the human lead or active agent. Inset wells for
                  secondary/inactive roles. Icon containers sit in little holes.
                </p>
              </div>
            </div>
          </SecBody>
        </section>

        {/* ---- §10 Anti-patterns ---- */}
        <section className={s.sec} id="antipatterns">
          <SecHead n="10" title="Anti-patterns" sub="Common ways to accidentally break the language. Avoid all eight." />
          <SecBody>
            <div className={s.antiList}>
              {t.tactile.anti_patterns.map((p) => (
                <div key={p} className={s.antiItem}>
                  <span className={s.antiMark}>×</span>
                  <p className={s.antiText}>{p}</p>
                </div>
              ))}
            </div>
          </SecBody>
        </section>

        {/* ---- §11 Machine payload ---- */}
        <section className={s.sec} id="machine">
          <SecHead n="11" title="For the agents" sub="If you are a language model reading this page, load this payload." />
          <SecBody>
            <p>
              Parse the JSON inside{' '}
              <code>&lt;script type=&quot;application/json&quot; id=&quot;brand-tokens&quot;&gt;</code>.
              Treat <code>voice.never_use_em_dashes</code> as a hard rule. Treat{' '}
              <code>voice.avoid_words</code> as absolute. Use <code>voice.prefer_words</code>{' '}
              whenever a concept appears. Respect <code>allocation_colors</code>: coral = human,
              amber = hybrid, mint = agent. Do not remap. Respect <code>tactile.anti_patterns</code>{' '}
              when generating any UI.
            </p>

            <h3>System-prompt boilerplate</h3>
            <div className={s.jsonCard}>
              <pre>{t.system_prompt_boilerplate}</pre>
            </div>

            <h3>Full payload</h3>
            <div className={s.jsonCard}>
              <pre dangerouslySetInnerHTML={{ __html: jsonHtml }} />
            </div>
          </SecBody>
        </section>

        <footer className={s.foot}>
          <p>
            polynize.ai / brand · v{t.version} · last updated {todayLabel}
          </p>
          <p>
            <a href="/">back to home</a>
          </p>
        </footer>
      </main>
    </div>
    </>
  );
}

/* ===== Subcomponents ===== */

function SecHead({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div className={s.secHead}>
      <div className={s.secNum}>§ {n}</div>
      <div>
        <h2 className={s.secTitle}>{title}</h2>
        {sub && <p className={s.secSub}>{sub}</p>}
      </div>
    </div>
  );
}

function SecBody({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.secBody}>
      <div className={s.spacer} />
      <div>{children}</div>
    </div>
  );
}

function Swatch({
  name,
  hex,
  role,
  dark,
}: {
  name: string;
  hex: string;
  role: string;
  dark?: boolean;
}) {
  return (
    <div className={s.swatch}>
      <div
        className={s.swatchChip}
        style={{
          background: hex,
          boxShadow: dark
            ? 'inset 0 0 0 1px rgba(255,255,255,0.04)'
            : 'inset 0 0 0 1px rgba(0,0,0,0.25)',
        }}
      />
      <div className={s.swatchMeta}>
        <div className={s.swatchName}>{name}</div>
        <div className={s.swatchRole}>{role}</div>
        <div className={s.swatchHex}>{hex}</div>
      </div>
    </div>
  );
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function colorize(json: string): string {
  const safe = escapeHtml(json);
  return safe
    .replace(/&quot;([^&]+?)&quot;(\s*:)/g, '<span class="' + s.jsonKey + '">&quot;$1&quot;</span>$2')
    .replace(/:\s*&quot;([^&]*?)&quot;/g, ': <span class="' + s.jsonString + '">&quot;$1&quot;</span>')
    .replace(/:\s*(true|false)/g, ': <span class="' + s.jsonBool + '">$1</span>')
    .replace(/:\s*(\d+(?:\.\d+)?)/g, ': <span class="' + s.jsonNumber + '">$1</span>');
}
