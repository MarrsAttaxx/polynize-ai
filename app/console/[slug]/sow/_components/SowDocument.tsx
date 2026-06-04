/**
 * Statement of Works document renderer (server component).
 *
 * Composes the full pack: the cover table, SoW sections 1-11, and Annexure A
 * (the Service Agreement: Part A Key Details, Part B clauses 1-25, Schedules
 * 1-4). AUTO content comes from the SowDoc; HUMAN fields render as editable
 * SowField islands (NEEDS INPUT badge when empty). The Service Agreement
 * clauses render verbatim from lib/sow/template.ts.
 *
 * The instructional "delete this page" pages from the source templates are not
 * reproduced here, by design (author guidance, not client content).
 */

import type { SowDoc } from '@/lib/sow/schema';
import {
  BUILD_SEQUENCE,
  SA_CLAUSES,
  SA_SCHEDULES,
  humanFieldDef,
} from '@/lib/sow/template';
import { SowField } from './SowField';
import s from '../sow.module.css';

function H({ value, slug, path, canEdit, multiline }: {
  value: string | null;
  slug: string;
  path: string; // human.<key>
  canEdit: boolean;
  multiline?: boolean;
}) {
  const key = path.split('.')[1];
  const label = humanFieldDef(key)?.label ?? key;
  return (
    <SowField slug={slug} path={path} value={value} label={label} canEdit={canEdit} multiline={multiline} />
  );
}

function A({ value, slug, path, label, canEdit, multiline }: {
  value: string | null;
  slug: string;
  path: string; // auto.<...>
  label: string;
  canEdit: boolean;
  multiline?: boolean;
}) {
  return (
    <SowField slug={slug} path={path} value={value} label={label} canEdit={canEdit} multiline={multiline} />
  );
}

export function SowDocument({
  doc,
  slug,
  canEdit,
}: {
  doc: SowDoc;
  slug: string;
  canEdit: boolean;
}) {
  const a = doc.auto;
  const h = doc.human;
  const hv = (k: string) => h[k] ?? null;

  const humanHeldExample =
    a.human_held.slice(0, 3).join(', ') || 'the items marked human-checked';

  return (
    <div className={s.doc}>
      {/* ===== Cover ===== */}
      <div className={s.coverEyebrow}>POLYNIZE · AGENTIC MESH · BUILD &amp; DEPLOYMENT</div>
      <h1 className={s.coverTitle}>Statement of Works</h1>
      <p className={s.coverSub}>
        Agent Team build. Incorporates the Polynize Service Agreement at Annexure A.
      </p>

      <table className={s.kv}>
        <tbody>
          <tr><th>Provider</th><td>Polynize Pty Ltd (ACN <H slug={slug} path="human.polynize_acn" value={hv('polynize_acn')} canEdit={canEdit} />)</td></tr>
          <tr><th>Client</th><td><H slug={slug} path="human.client_legal_name" value={hv('client_legal_name')} canEdit={canEdit} /> (ACN/ABN <H slug={slug} path="human.client_acn_abn" value={hv('client_acn_abn')} canEdit={canEdit} />)</td></tr>
          <tr><th>Engagement</th><td><A slug={slug} path="auto.engagement_name" value={a.engagement_name} label="Engagement name" canEdit={canEdit} /></td></tr>
          <tr><th>SoW reference</th><td className={s.mono}>{doc.sow_reference}</td></tr>
          <tr><th>Agent Team</th><td>The agents listed in section 3</td></tr>
          <tr><th>Derived from</th><td>{doc.generated_from}</td></tr>
          <tr><th>Estimated build</th><td><H slug={slug} path="human.estimated_build" value={hv('estimated_build')} canEdit={canEdit} /> for the first build cycle</td></tr>
          <tr><th>Total fee</th><td>{'$'}<H slug={slug} path="human.total_fee" value={hv('total_fee')} canEdit={canEdit} /> + GST (see section 9)</td></tr>
          <tr><th>Status</th><td>DRAFT. Complete the NEEDS INPUT fields and have it reviewed before use.</td></tr>
        </tbody>
      </table>
      <p className={s.govern}>Governed by the laws of Victoria, Australia.</p>

      {/* ===== 1. Parties ===== */}
      <Section n="1" title="Parties and engagement">
        <p>
          {'This Statement of Works is made between Polynize Pty Ltd (ACN '}
          <H slug={slug} path="human.polynize_acn" value={hv('polynize_acn')} canEdit={canEdit} />
          {') (“Polynize”) and '}
          <H slug={slug} path="human.client_legal_name" value={hv('client_legal_name')} canEdit={canEdit} />
          {' (ACN/ABN '}
          <H slug={slug} path="human.client_acn_abn" value={hv('client_acn_abn')} canEdit={canEdit} />
          {') (the “Client”), with effect from the date it is signed by the Client (the “Effective Date”).'}
        </p>
        <p>
          {'Under it, Polynize will design, build, test and hand over an AI agent team for the Client, as described below. This SoW incorporates the Polynize Service Agreement set out at Annexure A, which contains the legal terms that apply. By signing this SoW, the Client agrees to this SoW and the Service Agreement together (see section 8).'}
        </p>
      </Section>

      {/* ===== 2. At a glance ===== */}
      <Section n="2" title="At a glance (plain-English summary)">
        <p className={s.muted}>
          {'This summary is a quick guide only. The Statement of Works and the Service Agreement (Annexure A) are what actually bind the parties.'}
        </p>
        <ul className={s.glance}>
          <li><strong>What this is.</strong> {'Polynize will build an AI agent team for you, as described in this SoW. Signing it also accepts the Service Agreement (Annexure A), which holds the full legal terms.'}</li>
          <li>
            <strong>What we will do.</strong>{' '}
            {'Design, build, test and hand over the agents and capabilities listed in section 3, over an estimated '}
            <H slug={slug} path="human.estimated_build" value={hv('estimated_build')} canEdit={canEdit} />
            {' first build cycle (section 5).'}
          </li>
          <li><strong>What you will do.</strong> {`Give us timely access and accurate data; train your people on the operating procedures (SOPs) we provide; and keep a human reviewing or approving the items we have marked as human-checked (for example, ${humanHeldExample}).`}</li>
          <li><strong>What it is built for.</strong> {'The agents do the specific jobs in section 3. Using them for something else, reconfiguring them, or removing the human checks is outside this agreement and at your risk.'}</li>
          <li><strong>About the AI.</strong> {'The agents use AI. We tune the Cognition layer to reduce errors and hallucination as far as practicable, but that can never be reduced to zero, which is why the human checks matter.'}</li>
          <li><strong>After handoff.</strong> {'We support the agents doing what this SoW says they do; anything outside that is separate (the Service Agreement).'}</li>
          <li>
            <strong>Fees.</strong>{' $'}
            <H slug={slug} path="human.total_fee" value={hv('total_fee')} canEdit={canEdit} />
            {' + GST, payable at the milestones in section 9. Invoices are due in '}
            <H slug={slug} path="human.payment_days" value={hv('payment_days')} canEdit={canEdit} />
            {' days.'}
          </li>
          <li><strong>Liability and law.</strong> {'Liability is capped and some losses are excluded (Service Agreement, clauses 16 to 17). Governed by the laws of Victoria, Australia.'}</li>
        </ul>
      </Section>

      {/* ===== 3. Scope ===== */}
      <Section n="3" title="Scope of works">
        <p>
          <strong>Background.</strong>{' '}
          <A slug={slug} path="auto.background" value={a.background} label="Background" canEdit={canEdit} multiline />
        </p>

        <h3 className={s.sub}>3.1 The Agent Team</h3>
        <p className={s.muted}>Polynize will build the following agents:</p>
        <table className={s.grid}>
          <thead><tr><th>Agent</th><th>Role</th></tr></thead>
          <tbody>
            {a.agent_team.map((ag, i) => (
              <tr key={i}>
                <td><A slug={slug} path={`auto.agent_team.${i}.name`} value={ag.name} label="Agent name" canEdit={canEdit} /></td>
                <td><A slug={slug} path={`auto.agent_team.${i}.role`} value={ag.role} label="Agent role" canEdit={canEdit} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className={s.sub}>3.2 In scope</h3>
        <ol className={s.lettered}>
          {a.in_scope.map((item, i) => (
            <li key={i}><A slug={slug} path={`auto.in_scope.${i}`} value={item} label="In-scope item" canEdit={canEdit} multiline /></li>
          ))}
        </ol>

        <h3 className={s.sub}>3.3 Out of scope (excluded)</h3>
        <p className={s.muted}>
          {'The following are not part of this build and remain the Client’s responsibility unless agreed separately:'}
        </p>
        <ol className={s.lettered}>
          {a.out_of_scope.map((item, i) => (
            <li key={i}><A slug={slug} path={`auto.out_of_scope.${i}`} value={item} label="Out-of-scope item" canEdit={canEdit} multiline /></li>
          ))}
          <li>{'anything not expressly listed in this section 3.'}</li>
        </ol>

        <h3 className={s.sub}>3.4 Capability schedule</h3>
        <p className={s.muted}>
          {'Each capability is delivered as agent-run (automated), hybrid (agent assists, human decides) or human-held (no agent), with the human check shown:'}
        </p>
        <table className={s.grid}>
          <thead><tr><th>#</th><th>Capability</th><th>How it is done</th><th>Human check / handoff</th></tr></thead>
          <tbody>
            {a.capability_schedule.map((row, i) => (
              <tr key={row.id}>
                <td className={s.mono}>{row.id}</td>
                <td><A slug={slug} path={`auto.capability_schedule.${i}.name`} value={row.name} label="Capability" canEdit={canEdit} /></td>
                <td><A slug={slug} path={`auto.capability_schedule.${i}.how`} value={row.how} label="How it is done" canEdit={canEdit} /></td>
                <td><A slug={slug} path={`auto.capability_schedule.${i}.human_check`} value={row.human_check} label="Human check" canEdit={canEdit} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ===== 4. Targets ===== */}
      <Section n="4" title="Targets">
        <p className={s.muted}>
          {'The build aims at the targets below. These are good-faith targets, dependent on the quality of Client data and the Client following the SOPs. They are targets, not guarantees (see Service Agreement, clauses 5.2 and 15).'}
        </p>
        <table className={s.grid}>
          <thead><tr><th>Capability</th><th>Target</th></tr></thead>
          <tbody>
            {a.targets.map((t, i) => (
              <tr key={i}>
                <td><A slug={slug} path={`auto.targets.${i}.capability`} value={t.capability} label="Capability" canEdit={canEdit} /></td>
                <td><A slug={slug} path={`auto.targets.${i}.target`} value={t.target} label="Target" canEdit={canEdit} multiline /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ===== 5. Approach ===== */}
      <Section n="5" title="Approach, build phases and timeline">
        <h3 className={s.sub}>5.1 Motions</h3>
        <ul className={s.motions}>
          {a.motions.map((m, i) => (
            <li key={i}>
              <strong><A slug={slug} path={`auto.motions.${i}.label`} value={m.label} label="Motion" canEdit={canEdit} />.</strong>{' '}
              <A slug={slug} path={`auto.motions.${i}.description`} value={m.description} label="Motion description" canEdit={canEdit} multiline />
            </li>
          ))}
        </ul>

        <h3 className={s.sub}>5.2 Build sequence per agent</h3>
        <p>
          {'Each agent is built through the same stages: '}
          {(a.build_sequence.length ? a.build_sequence : BUILD_SEQUENCE).join(' → ')}.
        </p>

        <h3 className={s.sub}>5.3 Phases and timeline</h3>
        <p className={s.muted}>
          {'The first build cycle is estimated at '}
          <H slug={slug} path="human.estimated_build" value={hv('estimated_build')} canEdit={canEdit} />
          {' from Gate 03 (this SoW).'}
        </p>
        <table className={s.grid}>
          <thead><tr><th>Phase</th><th>What happens</th><th>Indicative timing</th></tr></thead>
          <tbody>
            <tr><td>First build wave</td><td>{'Build the first-wave capabilities'}</td><td><H slug={slug} path="human.estimated_build" value={hv('estimated_build')} canEdit={canEdit} /></td></tr>
            <tr><td>Training</td><td>{'People uplift on review craft, alongside the build'}</td><td>Concurrent</td></tr>
            <tr><td>Transform</td><td>{'Process redesign, after the first agents are stable'}</td><td>After first build</td></tr>
            <tr><td>Handoff (Gate 04)</td><td>{'Operational ownership passes to the Client on acceptance (section 6)'}</td><td>End of build cycle</td></tr>
          </tbody>
        </table>
      </Section>

      {/* ===== 6. Deliverables ===== */}
      <Section n="6" title="Deliverables, acceptance and handoff">
        <p><strong>6.1 Deliverables.</strong> {'Polynize will deliver:'}</p>
        <ol className={s.lettered}>
          <li>{'the configured Agent Team in section 3, with installed Cognition, Skills and Connectors for each capability;'}</li>
          <li>
            {'the integrations identified in the Blueprint ('}
            <A slug={slug} path="auto.integrations.0" value={a.integrations.join(', ') || null} label="Integrations" canEdit={false} />
            {a.integrations.length ? '' : 'ticketing, email, messaging and data tools'}
            {');'}
          </li>
          <li>{'Sandbox testing and live testing against the capability schedule; and'}</li>
          <li>{'the SOPs for operating the Agent Team, and handoff of operational ownership at Gate 04.'}</li>
        </ol>
        <p>
          <strong>6.2 Acceptance.</strong>{' '}
          {'Polynize will notify the Client when each deliverable is ready. The Client has '}
          <H slug={slug} path="human.acceptance_window_days" value={hv('acceptance_window_days')} canEdit={canEdit} />
          {' business days to accept or to reject (only for a material failure against this SoW, in writing with detail). A deliverable is accepted on the earlier of written acceptance, live use, or the end of the testing period without valid rejection. Acceptance and handoff follow clause 6 of the Service Agreement.'}
        </p>
        <p>
          <strong>6.3 Handoff (Gate 04).</strong>{' '}
          {'On acceptance, operational ownership passes to the Client, who then operates the Agent Team in line with the SOPs. From handoff, the support boundary in clause 19 of the Service Agreement applies: in-scope matters are supported as agreed; anything outside this SoW or the SOPs is separate.'}
        </p>
      </Section>

      {/* ===== 7. Responsibilities ===== */}
      <Section n="7" title="Your responsibilities">
        <p>
          {'To let us deliver and to keep the Agent Team working as designed, the Client will (see clause 5 of the Service Agreement for the full terms): provide timely, accurate and lawful data and access; nominate and make available the people who will review and approve agent output; ensure its people are trained on and follow the SOPs; and keep the human-in-the-loop checks in section 3.4 in place rather than bypassing them.'}
        </p>
      </Section>

      {/* ===== 8. Legal terms ===== */}
      <Section n="8" title="The legal terms (Service Agreement)">
        <p>
          {'The legal terms for this engagement, including intellectual property, confidentiality, privacy, the nature of AI output and human oversight, warranties, the Australian Consumer Law position, limitation of liability, the indemnity and the support boundary, are set out in the Polynize Service Agreement at Annexure A, which is incorporated into and forms part of this SoW. By signing this SoW, the Client agrees to those terms.'}
        </p>
        <p className={s.muted}>
          {'If there is any inconsistency, this SoW governs the works, deliverables, fees and timeline; the Service Agreement governs the legal and risk terms (Service Agreement, clause 2).'}
        </p>
      </Section>

      {/* ===== 9. Fees ===== */}
      <Section n="9" title="Fees, payment and invoicing">
        <p>
          <strong>9.1 Fees.</strong>{' '}
          {'The fees for the works are set out below and are exclusive of GST. Third-party costs such as cloud hosting and model usage are '}
          <H slug={slug} path="human.third_party_costs" value={hv('third_party_costs')} canEdit={canEdit} />
          {'.'}
        </p>
        <table className={s.grid}>
          <thead><tr><th>Milestone</th><th>Trigger</th><th>Amount (ex GST)</th></tr></thead>
          <tbody>
            <tr><td>Build commencement</td><td>On signing this SoW (Gate 03)</td><td>{'$'}<H slug={slug} path="human.milestone_build_amount" value={hv('milestone_build_amount')} canEdit={canEdit} /></td></tr>
            <tr><td>Handoff</td><td>On acceptance (Gate 04)</td><td>{'$'}<H slug={slug} path="human.milestone_handoff_amount" value={hv('milestone_handoff_amount')} canEdit={canEdit} /></td></tr>
            <tr><td>Support (if taken)</td><td>Per <H slug={slug} path="human.support_period" value={hv('support_period')} canEdit={canEdit} /></td><td>{'$'}<H slug={slug} path="human.support_fee" value={hv('support_fee')} canEdit={canEdit} /></td></tr>
          </tbody>
        </table>
        <p>
          <strong>9.2 Payment.</strong>{' '}
          {'Invoices are payable within '}
          <H slug={slug} path="human.payment_days" value={hv('payment_days')} canEdit={canEdit} />
          {' days, in AUD, without set-off. Late and suspension terms are in clause 7 of the Service Agreement.'}
        </p>
        <p>
          <strong>9.3 Invoicing on signing.</strong>{' '}
          {'On the Client signing this SoW, Polynize will issue a tax invoice for the build-commencement milestone to the Client’s nominated billing email ('}
          <H slug={slug} path="human.billing_email" value={hv('billing_email')} canEdit={canEdit} />
          {') automatically. Signing authorises that invoice to be raised.'}
        </p>
      </Section>

      {/* ===== Execution ===== */}
      <Section n="" title="Execution">
        <p>
          {'Signing this Statement of Works binds both this SoW and the Service Agreement at Annexure A. Polynize has signed below; please sign to accept.'}
        </p>
        <div className={s.sign}>
          <div className={s.signCol}>
            <div className={s.signHead}>Signed for and on behalf of Polynize (Provider)</div>
            <div>Polynize Pty Ltd (ACN <H slug={slug} path="human.polynize_acn" value={hv('polynize_acn')} canEdit={canEdit} />)</div>
            <dl className={s.signFields}>
              <div><dt>Name</dt><dd><H slug={slug} path="human.signatory_name" value={hv('signatory_name')} canEdit={canEdit} /></dd></div>
              <div><dt>Title / position</dt><dd><H slug={slug} path="human.signatory_title" value={hv('signatory_title')} canEdit={canEdit} /></dd></div>
              <div><dt>Date</dt><dd><H slug={slug} path="human.date_sent" value={hv('date_sent')} canEdit={canEdit} /></dd></div>
            </dl>
          </div>
          <div className={s.signCol}>
            <div className={s.signHead}>Signed for and on behalf of the Client</div>
            <div><H slug={slug} path="human.client_legal_name" value={hv('client_legal_name')} canEdit={canEdit} /> (ACN/ABN <H slug={slug} path="human.client_acn_abn" value={hv('client_acn_abn')} canEdit={canEdit} />)</div>
            <dl className={s.signFields}>
              <div><dt>Name</dt><dd className={s.signBlank}>&nbsp;</dd></div>
              <div><dt>Title / position</dt><dd className={s.signBlank}>&nbsp;</dd></div>
              <div><dt>Date</dt><dd className={s.signBlank}>&nbsp;</dd></div>
            </dl>
          </div>
        </div>
      </Section>

      {/* ===== Annexure A — Service Agreement ===== */}
      <div className={s.annexBreak}>
        <div className={s.coverEyebrow}>ANNEXURE A</div>
        <h1 className={s.coverTitle}>Polynize Service Agreement</h1>
        <p className={s.coverSub}>
          Agent Team Build, legal terms. Annexure A to, and incorporated into, the Statement of Works.
        </p>
        <p className={s.muted}>
          {'The Polynize Service Agreement is incorporated into this Statement of Works under section 8. It contains the legal terms that apply to this engagement. It is signed via the Statement of Works (clause 25.7): there is no separate signature on this Annexure.'}
        </p>
      </div>

      {/* Part A — Key Details */}
      <Section n="" title="Part A — Key Details">
        <table className={s.kv}>
          <tbody>
            <tr><th>Provider</th><td>Polynize Pty Ltd (ACN <H slug={slug} path="human.polynize_acn" value={hv('polynize_acn')} canEdit={canEdit} />), of <H slug={slug} path="human.polynize_address" value={hv('polynize_address')} canEdit={canEdit} />, Victoria</td></tr>
            <tr><th>Client</th><td><H slug={slug} path="human.client_legal_name" value={hv('client_legal_name')} canEdit={canEdit} /> (ACN/ABN <H slug={slug} path="human.client_acn_abn" value={hv('client_acn_abn')} canEdit={canEdit} />), of <H slug={slug} path="human.client_address" value={hv('client_address')} canEdit={canEdit} /></td></tr>
            <tr><th>Client contact</th><td><H slug={slug} path="human.client_contact" value={hv('client_contact')} canEdit={canEdit} /></td></tr>
            <tr><th>Provider contact</th><td><H slug={slug} path="human.polynize_contact" value={hv('polynize_contact')} canEdit={canEdit} /></td></tr>
            <tr><th>Engagement</th><td>{a.engagement_name}</td></tr>
            <tr><th>The Agent Team</th><td>{'The agents, capabilities and configuration described in the Blueprint at Schedule 1 (the agents named in section 3 of the SoW).'}</td></tr>
            <tr><th>Permitted Purpose</th><td>{`Use of the ${a.engagement_name} Agent Team within the Client’s business, strictly in accordance with the Specifications and the SOPs (see clause 9).`}</td></tr>
            <tr><th>Blueprint</th><td>{doc.generated_from}, attached as Schedule 1</td></tr>
            <tr><th>Build window</th><td>Estimated <H slug={slug} path="human.estimated_build" value={hv('estimated_build')} canEdit={canEdit} /> first build cycle from Gate 03, subject to clause 6 and Client dependencies</td></tr>
            <tr><th>Fees</th><td>{'$'}<H slug={slug} path="human.total_fee" value={hv('total_fee')} canEdit={canEdit} /> + GST (staged per the SoW fees section)</td></tr>
            <tr><th>Payment terms</th><td><H slug={slug} path="human.payment_terms" value={hv('payment_terms')} canEdit={canEdit} />, <H slug={slug} path="human.payment_days" value={hv('payment_days')} canEdit={canEdit} /> days from invoice; see clause 7</td></tr>
            <tr><th>Liability cap</th><td><H slug={slug} path="human.liability_cap" value={hv('liability_cap')} canEdit={canEdit} multiline />; see clause 17</td></tr>
            <tr><th>Term</th><td>From the Effective Date until <H slug={slug} path="human.term_end" value={hv('term_end')} canEdit={canEdit} />; see clause 20</td></tr>
            <tr><th>Support after Handoff</th><td>{'As set out in Schedule 4, in-scope only; see clause 19'}</td></tr>
            <tr><th>Governing law</th><td>Victoria, Australia</td></tr>
            <tr><th>Effective Date</th><td>{'The date the Statement of Works is executed'}</td></tr>
          </tbody>
        </table>
      </Section>

      {/* Part B — Terms (verbatim static) */}
      <div className={s.partHead}>Part B — Terms</div>
      <p className={s.muted}>
        {'These Terms, together with Part A and the Schedules, form the entire agreement between the Provider and the Client for the design, build and deployment of the Agent Team (the “Agreement”).'}
      </p>
      {SA_CLAUSES.map((c) => (
        <div key={c.n} className={s.clause}>
          <h3 className={s.clauseTitle}>{c.n}. {c.title}</h3>
          {c.body.map((p, i) => (
            <p key={i} className={s.clauseBody}>{p}</p>
          ))}
          {c.note && <p className={s.draftNote}>Drafting note: {c.note}</p>}
        </div>
      ))}

      {/* Schedules (verbatim static) */}
      {SA_SCHEDULES.map((sch, i) => (
        <div key={i} className={s.clause}>
          <h3 className={s.clauseTitle}>{sch.title}</h3>
          {sch.body.map((p, j) => (
            <p key={j} className={s.clauseBody}>{p}</p>
          ))}
        </div>
      ))}

      <p className={s.footer}>
        End of Statement of Works and Annexure A. Not legal advice; have an admitted Victorian lawyer review before use.
      </p>
    </div>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={s.section}>
      <h2 className={s.sectionTitle}>
        {n ? <span className={s.sectionNum}>{n}</span> : null}
        {title}
      </h2>
      {children}
    </section>
  );
}
