/**
 * Static SoW + Service Agreement template content (Polynize SoW v0.1 /
 * Service Agreement v0.2).
 *
 * This module holds the parts of the document that are the SAME for every
 * engagement:
 *   - HUMAN_FIELDS  — the commercial/legal field registry (key, label,
 *                     default). A field with a null default and no value
 *                     renders as a NEEDS INPUT badge; a field with a default
 *                     renders the default (editable).
 *   - BUILD_SEQUENCE — the eight sprint stages (§5.2 constant).
 *   - SA_CLAUSES / SA_SCHEDULES — the Service Agreement Part B legal terms,
 *                     reproduced VERBATIM from the reviewed template.
 *
 * Em-dash note: the house rule forbids em-dashes in copy WE generate. The
 * clause text below is reproduced verbatim from a reviewed legal template;
 * altering its punctuation would be rewording a reviewed contract, which the
 * brief explicitly forbids ("keep the legal language EXACTLY"). So the static
 * legal text keeps the punctuation it was reviewed with; all merge-generated
 * copy (lib/sow/generate.ts) stays em-dash-free.
 */

export const BUILD_SEQUENCE: string[] = [
  'Sprint Map',
  'Cognition Design',
  'Skills Design',
  'Cognition Install',
  'Skills Install',
  'Sandbox Testing',
  'Live Testing',
  'Handoff',
];

export interface HumanFieldDef {
  key: string;
  label: string;
  /** null → renders as NEEDS INPUT until completed. A string → editable default. */
  default: string | null;
  /**
   * Who completes this field. Drives the fill colour (polynize = mint,
   * client = orange) and who may edit it: a client-scope user may edit only
   * 'client'-owned fields; 'polynize' fields are team-only.
   */
  owner: 'polynize' | 'client';
}

/**
 * The commercial / legal fields a team member completes. Keys are referenced
 * by the render page and the field-edit API path allowlist. Defaults mirror
 * the template's bracketed defaults; null fields have no sensible default and
 * surface as NEEDS INPUT.
 */
export const HUMAN_FIELDS: HumanFieldDef[] = [
  // Parties / identity — the things only the client knows about their entity
  // are CLIENT-owned; the Polynize-entity fields are POLYNIZE-owned.
  { key: 'client_legal_name', label: 'Client legal name', default: null, owner: 'client' },
  { key: 'client_acn_abn', label: 'Client ACN/ABN', default: null, owner: 'client' },
  { key: 'client_address', label: 'Client registered address', default: null, owner: 'client' },
  { key: 'client_contact', label: 'Client contact (name, title, email)', default: null, owner: 'client' },
  { key: 'polynize_acn', label: 'Polynize ACN', default: null, owner: 'polynize' },
  { key: 'polynize_address', label: 'Polynize registered address', default: null, owner: 'polynize' },
  { key: 'polynize_contact', label: 'Polynize contact (name, title, email)', default: null, owner: 'polynize' },
  // Commercial — Polynize sets the terms; billing_email is the client's.
  { key: 'total_fee', label: 'Total fee (ex GST)', default: null, owner: 'polynize' },
  // Lifecycle fee schedule (§9.1): Modelling -> Build -> Handoff -> Operate.
  // modelling_fee is settled at the modelling phase, before this SoW is signed,
  // so its row is marked Paid; the amount still varies per engagement (NEEDS INPUT).
  { key: 'modelling_fee', label: 'Modelling fee (ex GST)', default: null, owner: 'polynize' },
  { key: 'milestone_build_amount', label: 'Build commencement amount (ex GST)', default: null, owner: 'polynize' },
  { key: 'milestone_handoff_amount', label: 'Handoff amount (ex GST)', default: null, owner: 'polynize' },
  // Operate = the monthly post-handoff service (formerly "Support"). Keys are
  // kept as support_fee / support_period so any already-filled data survives;
  // only the display labels are renamed to Operate.
  { key: 'support_fee', label: 'Operate fee (ex GST, per month)', default: null, owner: 'polynize' },
  // support_period: ambiguous, defaulted to polynize (it pairs with support_fee).
  { key: 'support_period', label: 'Operate billing period', default: 'month', owner: 'polynize' },
  // operate_start_date: when monthly Operate billing begins (varies per engagement).
  { key: 'operate_start_date', label: 'Operate start date', default: null, owner: 'polynize' },
  { key: 'billing_email', label: 'Billing email', default: null, owner: 'client' },
  { key: 'payment_days', label: 'Payment days', default: '14', owner: 'polynize' },
  { key: 'payment_terms', label: 'Payment terms', default: '50% on Gate 03, 50% on Handoff', owner: 'polynize' },
  // third_party_costs: ambiguous, defaulted to polynize (a commercial term Polynize sets).
  { key: 'third_party_costs', label: 'Third-party pass-through costs', default: "the Client's responsibility", owner: 'polynize' },
  // Legal / risk
  {
    key: 'liability_cap',
    label: 'Liability cap',
    default:
      'the total Fees paid by the Client under this Agreement in the 12 months before the event giving rise to the liability',
    owner: 'polynize',
  },
  { key: 'term_end', label: 'Term end', default: 'Handoff', owner: 'polynize' },
  { key: 'acceptance_window_days', label: 'Acceptance window (business days)', default: '10', owner: 'polynize' },
  // Timeline — estimated_build: ambiguous, defaulted to polynize (the build window Polynize commits to).
  { key: 'estimated_build', label: 'Estimated build window', default: '4 to 6 weeks', owner: 'polynize' },
  // Execution
  // Pre-filled so the Polynize signature renders (cursive) from the start.
  { key: 'signatory_name', label: 'Polynize signatory name', default: 'Marrs Coiro', owner: 'polynize' },
  { key: 'signatory_title', label: 'Polynize signatory title', default: 'Founder', owner: 'polynize' },
  { key: 'date_sent', label: 'Date sent', default: null, owner: 'polynize' },
];

export const HUMAN_FIELD_KEYS: ReadonlySet<string> = new Set(
  HUMAN_FIELDS.map((f) => f.key)
);

export function humanFieldDef(key: string): HumanFieldDef | undefined {
  return HUMAN_FIELDS.find((f) => f.key === key);
}

/** Owner of a HUMAN field. Unknown keys default to 'polynize' (team-only). */
export function humanFieldOwner(key: string): 'polynize' | 'client' {
  return humanFieldDef(key)?.owner ?? 'polynize';
}

/** A Service Agreement Part B clause: number, title, and verbatim body parts. */
export interface SaClause {
  n: string;
  title: string;
  /** Each entry is one paragraph or sub-clause, rendered in order. */
  body: string[];
  /** Optional verbatim italic drafting note shown under the clause. */
  note?: string;
}

/**
 * Service Agreement, Part B — Terms. Clauses 1-25, verbatim from the reviewed
 * template (v0.2). Rendered as STATIC content under Annexure A. The bracketed
 * defaults inside the clauses (e.g. [14] days) are the template's reviewed
 * defaults and render as-is.
 */
export const SA_CLAUSES: SaClause[] = [
  {
    n: '1',
    title: 'Definitions and interpretation',
    body: [
      '1.1 In this Agreement, unless the context requires otherwise:',
      '“Agent” and “Agent Team” mean the software agent or coordinated set of software agents (including the agents named in the Blueprint) designed, configured and delivered by the Provider under this Agreement.',
      '“Background IP” means all Intellectual Property Rights owned or licensed by the Provider that exist independently of this Agreement or are developed otherwise than in performing the Services, including the Provider’s PAM framework, orchestration runtime, agent architecture patterns, tooling, libraries, prompts, methods, and the Blueprint format.',
      '“Blueprint” means the Provider’s Modelling Phase Blueprint for the Client set out in Schedule 1, as it may be updated by written agreement, which records the agreed Specifications for the Agent Team.',
      '“Build Plan” means the plan for the Build phase agreed at Gate 03, including the sub-phases (build infrastructure, install cognition, install skills and connectors, and sandbox) and the work plans for each Agent.',
      '“Business Day” means a day that is not a Saturday, Sunday or public holiday in Melbourne, Victoria.',
      '“Client Data” means all data, content and materials (including Personal Information, records, templates and historical communications) that the Client or its Personnel make available to the Provider or to the Agent Team, or that the Agent Team accesses through the Client’s systems.',
      '“Cognition” means the instructions, prompts, routing logic, classification taxonomies, thresholds and decision rules that govern how an Agent behaves, as designed and installed under this Agreement.',
      '“Confidential Information” has the meaning given in clause 12.',
      '“Connectors” and “Skills” mean the tools, actions, integrations and connections that give an Agent the ability to read from or act on Third Party Services and the Client’s systems, as specified in the Blueprint.',
      '“Consequential Loss” means loss of profit, revenue, anticipated savings, business, goodwill or opportunity; loss of or corruption of data; loss of use; and any indirect, special or consequential loss or damage, however arising.',
      '“Deliverables” means the Agent Team and the items the Provider is to deliver under this Agreement as described in the Blueprint and the Build Plan, including the installed Cognition, Skills and Connectors and the SOPs.',
      '“Gate” means a defined checkpoint in the Provider’s pipeline (Gate 01 Discovery; Gate 02 Proposal; Gate 03 Agreement and Build Plan; Gate 04 Handoff; Gate 05 Upsell).',
      '“GST” has the meaning given in the A New Tax System (Goods and Services Tax) Act 1999 (Cth).',
      '“Handoff” means Gate 04: the point at which the Provider hands operational ownership of the Agent Team to the Client following acceptance under clause 6.',
      '“Human-in-the-Loop Controls” means the human review, approval, confidence-threshold, fallback-queue and human-held decision points described in the Specifications (for example, capabilities marked HYBRID or HUMAN, and decisions the Blueprint records as held human).',
      '“Intellectual Property Rights” means all intellectual property rights anywhere in the world, whether registered or not, including copyright, patents, trade marks, designs, know-how, and rights in software, data and confidential information.',
      '“PAM” means the Polynize Agentic Mesh, the Provider’s proprietary architecture and method for building and operating agent teams.',
      '“Permitted Purpose” means the purpose for which the Agent Team is designed, as described in Part A and the Specifications, and no other purpose.',
      '“Personal Information” has the meaning given in the Privacy Act 1988 (Cth).',
      '“Personnel” means, in relation to a party, its officers, employees, agents and contractors.',
      '“Sandbox” means a controlled, non-production test environment used to verify the Agent Team before live use.',
      '“Services” means the design, build, configuration, installation, testing and delivery of the Agent Team, and any support expressly agreed in Schedule 4, as described in this Agreement.',
      '“SOPs” means the standard operating procedures, operating constraints and usage guidance the Provider provides for the operation of the Agent Team, as referenced in Schedule 3.',
      '“Specifications” means the agreed description of what the Agent Team is and does, as set out in the Statement of Works (which is derived from the Blueprint), including scope, included and excluded capabilities, allocations, benchmarks, integrations, thresholds and Human-in-the-Loop Controls.',
      '“Statement of Works” or “SoW” means the statement of works for the engagement that incorporates this Agreement and sets out the Specifications, the Deliverables, the Fees, the payment milestones and the timeline, and which is executed by the parties.',
      '“Third Party Services” means services, platforms, models and infrastructure not controlled by the Provider that the Agent Team relies on or connects to (for example, cloud hosting, model providers, and the Client’s own tools such as ticketing, email and messaging systems).',
      '1.2 Interpretation: headings are for convenience only; the singular includes the plural and vice versa; “including” and similar words are not words of limitation; a reference to a statute includes any amendment to it; a reference to a party includes its permitted successors and assigns; and a reference to “writing” includes email.',
    ],
  },
  {
    n: '2',
    title: 'Structure of this Agreement and order of precedence',
    body: [
      '2.1 This Agreement is Annexure A to, and is incorporated into and forms part of, the Statement of Works. Together they constitute the whole agreement between the parties for the engagement (the “Agreement”), and comprise: (a) the Statement of Works (including its commercial particulars and the Specifications); (b) these Terms (Part B); (c) Part A (Key Details); and (d) the Schedules to these Terms.',
      '2.2 If there is any inconsistency, the following order of precedence applies: (a) on the description of the works, the Deliverables, the Specifications, the Fees and the timeline, the Statement of Works prevails; and (b) on the parties’ legal rights, obligations, risk allocation and liability, these Terms prevail. The Statement of Works does not vary these Terms unless it expressly says so and is signed on that basis.',
      '2.3 No variation to this Agreement is effective unless it is in writing and signed by both parties. A change to the Specifications follows the change process in clause 6.5, and may be documented as a revised or further Statement of Works.',
    ],
  },
  {
    n: '3',
    title: 'The Services and the Build',
    body: [
      '3.1 The Provider will design, build, configure, install, test and deliver the Agent Team described in the Blueprint, and will perform the Services with due care and skill and in a professional manner.',
      '3.2 The Provider will deliver the Build in phases, which may include: (a) build infrastructure; (b) install Cognition; (c) install Skills and Connectors; and (d) Sandbox testing, followed by live testing and Handoff, broadly as described in the Build Plan.',
      '3.3 The Agent Team is designed to perform only the capabilities allocated to it in the Specifications. Capabilities recorded in the Specifications as excluded, or as held human, are not part of what the Agent Team is built to do. The Provider does not undertake that the Agent Team will perform any function outside the Specifications.',
      '3.4 The Provider may engage subcontractors and rely on Third Party Services to perform the Services, but remains responsible for the performance of the Services under this Agreement to the extent within its reasonable control.',
      '3.5 Anything not expressly included in the Specifications or the Build Plan is out of scope. Out-of-scope work may be quoted and agreed separately as a variation or a new Statement of Works.',
    ],
  },
  {
    n: '4',
    title: 'Provider responsibilities',
    body: [
      '4.1 The Provider will: (a) perform the Services in accordance with this Agreement; (b) use appropriately skilled Personnel; (c) deliver the Deliverables substantially in accordance with the Specifications; (d) provide the SOPs for the operation of the Agent Team; and (e) cooperate reasonably with the Client and keep the Client Representative reasonably informed of progress.',
    ],
  },
  {
    n: '5',
    title: 'Client responsibilities and dependencies',
    body: [
      '5.1 The Client acknowledges that the Provider’s ability to perform the Services, and the performance of the Agent Team, depend on the Client meeting its obligations. The Client will, at its own cost and in a timely way:',
      '(a) provide accurate, complete and lawful Client Data, access, accounts, credentials and environments needed for the Services and for the Agent Team to operate as specified;',
      '(b) ensure the quality, accuracy and currency of Client Data, and that the data fed to the Agent Team is of the kind the Agent Team is designed to process;',
      '(c) nominate and make available suitable Personnel (including any reviewers and decision-makers required by the Human-in-the-Loop Controls) and provide timely decisions, approvals and feedback;',
      '(d) ensure its Personnel are trained on, and operate the Agent Team strictly in accordance with, the SOPs and the Specifications;',
      '(e) maintain and not bypass, disable or weaken the Human-in-the-Loop Controls, including any human review, approval steps, confidence thresholds, fallback queues and human-held decisions specified in the Blueprint; and',
      '(f) obtain and maintain all consents, licences, authorisations and lawful bases required for the Client Data and for the Agent Team’s intended use, and comply with all laws applicable to the Client’s business and its use of the Agent Team.',
      '5.2 If the Client does not meet a dependency, the Provider is not liable for the resulting delay, cost or failure to meet a benchmark, and timeframes and benchmarks are adjusted accordingly. Benchmarks in the Specifications are good-faith targets dependent on Client Data and Client performance, not guarantees of outcome.',
      '5.3 The Client is solely responsible for ensuring that its use of the Agent Team complies with all laws and regulatory requirements applicable to the Client and its industry (for example, record-keeping, trust-account, consumer, advertising, financial, anti-money-laundering and privacy obligations). The Deliverables are operational tools only and do not constitute legal, regulatory, financial, accounting or other professional advice.',
    ],
  },
  {
    n: '6',
    title: 'Testing, acceptance and Handoff',
    body: [
      '6.1 Before live use, the Agent Team will be tested in the Sandbox against the Specifications. The Provider will notify the Client when a Deliverable is ready for acceptance testing.',
      '6.2 The Client will carry out acceptance testing within [10] Business Days. The Client may reject a Deliverable only where it materially fails to meet the Specifications, by written notice setting out the failure in reasonable detail. The Provider will use reasonable efforts to remedy a validly notified failure and re-submit.',
      '6.3 A Deliverable is accepted on the earlier of: (a) the Client confirming acceptance; (b) the Client using the Deliverable in live operation; or (c) the Client not providing valid written rejection within the testing period (“deemed acceptance”).',
      '6.4 Handoff (Gate 04) occurs when the Agent Team is accepted and operational ownership passes to the Client. From Handoff, the Client is responsible for operating the Agent Team in accordance with the SOPs, and the boundary in clause 19 and Schedule 4 applies.',
      '6.5 Either party may request a change to the Specifications. A change is only effective when agreed in writing, and may adjust the Fees, timeframes and benchmarks. The Provider is not obliged to start changed work until the change is agreed.',
    ],
  },
  {
    n: '7',
    title: 'Fees, GST and payment',
    body: [
      '7.1 The Client will pay the Fees set out in Part A and Schedule 2 at the times stated. Unless stated otherwise, Fees are exclusive of GST, which the Client will pay on receipt of a valid tax invoice.',
      '7.2 The Provider may invoice as set out in Schedule 2. Invoices are payable within [14] days of the invoice date. The Client must pay without set-off or deduction except as required by law.',
      '7.3 Overdue amounts may attract interest at [the RBA cash rate + 2%] per annum, calculated daily, and the Provider may suspend the Services or the Agent Team’s operation on [7] days’ written notice if undisputed amounts remain unpaid. Third-party pass-through costs (such as cloud hosting and model usage) are [the Client’s responsibility / as set out in Schedule 2].',
      '7.4 Fees already invoiced for Services performed are non-refundable except where required by law or expressly stated.',
    ],
    note: 'Set the staged triggers (e.g. on Gate 03 and on Handoff), the invoicing schedule and who carries ongoing cloud / model costs in Schedule 2. Confirm interest and suspension terms with your lawyer.',
  },
  {
    n: '8',
    title: 'Intellectual property',
    body: [
      '8.1 Background IP. All Background IP remains owned by the Provider (or its licensors). Nothing in this Agreement transfers the PAM framework, agent architecture, methods, tooling, prompts, or the Blueprint format to the Client. These are the Provider’s stock-in-trade and are reused across engagements.',
      '8.2 Client Data. The Client owns its Client Data. The Client grants the Provider a non-exclusive licence to use Client Data to the extent needed to perform the Services and operate the Agent Team.',
      '8.3 Licence to the Client. On full payment of the Fees due, the Provider grants the Client a non-exclusive, non-transferable, revocable licence to use the Agent Team and its installed Cognition, Skills and Connectors for the Permitted Purpose, for the Term. The licence does not include any right to copy, decompile, reverse engineer, resell, or repurpose the Background IP, or to use the Agent Team for a service bureau or to build a competing offering.',
      '8.4 Improvements and learnings. The Provider may use general know-how, techniques and improvements developed in the course of the Services, provided it does not disclose the Client’s Confidential Information or Client Data.',
    ],
    note: 'If the Client expects to own the deliverable outright (assignment rather than licence), this clause needs to change and the Fees should reflect it. Default here is a licence, which protects your reusable PAM IP.',
  },
  {
    n: '9',
    title: 'Permitted use and use outside the Specifications',
    body: [
      '9.1 The Agent Team has been designed, configured and delivered solely to perform the Permitted Purpose, as described in the Specifications in the Blueprint. It is a purpose-built system, not a general-purpose tool.',
      '9.2 The Client must use the Agent Team only: (a) for the Permitted Purpose; (b) within the scope, environments, data types, integrations and thresholds described in the Specifications; and (c) in accordance with the SOPs and the Human-in-the-Loop Controls.',
      '9.3 Any use of the Agent Team outside the Specifications, the Permitted Purpose or the SOPs — including using it on data, channels, volumes, jurisdictions or for tasks it was not designed for, modifying or reconfiguring it, connecting it to systems not specified, or removing or overriding a Human-in-the-Loop Control — is entirely at the Client’s own risk. Such use falls outside the Services and this Agreement, voids any warranty in relation to the affected output, and the Provider has no responsibility or liability for it or for anything resulting from it.',
      '9.4 The Client is responsible for the consequences of how it deploys, operates and relies on the Agent Team, including any decision the Client or its Personnel take on the basis of an Agent’s output.',
    ],
  },
  {
    n: '10',
    title: 'Acceptable use; no unlawful or malicious use',
    body: [
      '10.1 The Client must not, and must ensure its Personnel do not, use the Agent Team:',
      '(a) for any unlawful, fraudulent, deceptive or malicious purpose, or to harass, harm, defraud or deceive any person;',
      '(b) in a way that breaches any law (including privacy, consumer, spam, or anti-discrimination law) or the acceptable-use terms of any Third Party Service;',
      '(c) to send communications, make decisions or take actions without the human review or approval required by the Human-in-the-Loop Controls;',
      '(d) to input data the Client is not entitled to use, or that the Agent Team is not designed to handle; or',
      '(e) to attempt to circumvent, tamper with, overload or misuse the Agent Team or its safeguards.',
      '10.2 If the Agent Team is used in breach of clause 9 or 10, or for any malicious, negligent or unauthorised purpose, the resulting consequences — including any loss, corruption or disclosure of data, any communication sent, any decision made, any third-party claim and any regulatory action — are the Client’s sole responsibility, and the Provider has no liability for them.',
    ],
  },
  {
    n: '11',
    title: 'The nature of AI systems and human oversight',
    body: [
      '11.1 The Client acknowledges that the Agent Team uses artificial intelligence and large language models, and that such systems are probabilistic by nature. Their outputs can be incorrect, incomplete, inconsistent or unexpected (including so-called “hallucinations”), even when the system is functioning as designed.',
      '11.2 The Cognition layer designed and installed for the Agent Team (its instructions, routing logic, classification taxonomies, confidence thresholds and decision rules) is intended to reduce the incidence of inaccurate or fabricated output, and to manage hallucination, as far as is reasonably practicable for the Permitted Purpose. The Client acknowledges that this risk can be mitigated but never eliminated: it cannot be reduced to zero, and no part of this Agreement should be read as a representation that the Agent Team’s output will be free of error or hallucination.',
      '11.3 For this reason, the Specifications deliberately retain Human-in-the-Loop Controls for matters that require judgement (for example, approvals, exception handling, and decisions the Blueprint records as held human). The Client must keep these controls in place and ensure a competent human reviews and is accountable for output before it is relied on or acted on, in accordance with the SOPs.',
      '11.4 The Provider does not warrant that the Agent Team’s output will be accurate, complete or fit for any particular decision, and does not warrant uninterrupted or error-free operation. To the maximum extent permitted by law, the Provider is not liable for any loss arising from output that is incorrect, or from the Client acting on output without the human oversight the Specifications and SOPs require.',
      '11.5 The Agent Team does not provide professional advice. Output is an input to the Client’s own processes and judgement, not a substitute for it.',
    ],
  },
  {
    n: '12',
    title: 'Confidentiality',
    body: [
      '12.1 “Confidential Information” means non-public information disclosed by one party (“Discloser”) to the other (“Recipient”) that is marked or reasonably understood to be confidential, including the Provider’s Background IP and methods and the Client’s Client Data and business information, and the terms of this Agreement.',
      '12.2 The Recipient must keep the Discloser’s Confidential Information confidential, use it only for this Agreement, and disclose it only to Personnel who need it and are under equivalent obligations. This clause does not apply to information that is public (other than through breach), independently developed, rightfully received from a third party, or required to be disclosed by law.',
      '12.3 This clause survives termination.',
    ],
  },
  {
    n: '13',
    title: 'Privacy, data and security',
    body: [
      '13.1 Each party will comply with the Privacy Act 1988 (Cth) and the Australian Privacy Principles in relation to Personal Information handled under this Agreement.',
      '13.2 As between the parties, the Client is responsible for the Client Data, including having a lawful basis and any required notices and consents for the Provider and the Agent Team to handle it. The Provider will handle Personal Information only as reasonably needed to perform the Services and operate the Agent Team, on the Client’s behalf and in accordance with the Client’s reasonable instructions.',
      '13.3 Each party will take reasonable technical and organisational security measures appropriate to its role. The Client is responsible for the security of its own systems, accounts and credentials, and for access it grants to the Agent Team.',
      '13.4 The parties will cooperate reasonably and promptly in relation to any actual or suspected data breach involving Client Data, including any obligations under the Notifiable Data Breaches scheme. The Client is responsible for any breach notification relating to Client Data unless the breach is caused by the Provider’s breach of this Agreement.',
      '13.5 The Client acknowledges that the Agent Team relies on Third Party Services (clause 14) which process data outside the Provider’s control.',
    ],
    note: 'If you handle significant volumes of Personal Information, or any sensitive information, consider a separate data processing schedule and confirm where data is hosted and processed (the Blueprint references AWS, Bedrock, and the client’s own tools). Have your lawyer confirm the privacy split fits how PAM actually handles data.',
  },
  {
    n: '14',
    title: 'Third Party Services and dependencies',
    body: [
      '14.1 The Agent Team relies on Third Party Services (for example, cloud hosting, model providers, and the Client’s own ticketing, email and messaging tools). These are provided by third parties on their own terms, which the Client is responsible for holding and complying with where they are the Client’s services.',
      '14.2 The Provider is not responsible for Third Party Services, including their availability, performance, changes, deprecation, pricing, security or acts and omissions. A failure, change or outage in a Third Party Service that affects the Agent Team is not a breach by the Provider, and the Provider is not liable for the resulting impact, though it will use reasonable efforts to assist within the agreed support scope.',
    ],
  },
  {
    n: '15',
    title: 'Warranties and disclaimers',
    body: [
      '15.1 The Provider warrants that it will perform the Services with due care and skill and that the Deliverables will, at acceptance, substantially conform to the Specifications. This is the Client’s exclusive warranty in respect of the Deliverables, and the Provider’s sole obligation for a valid warranty claim is to re-perform or correct the affected Services or Deliverable.',
      '15.2 Except as expressly stated in this Agreement and to the maximum extent permitted by law, the Provider excludes all other warranties, representations, guarantees and conditions, whether express, implied or statutory, including any implied warranty of fitness for a particular purpose, merchantability, accuracy of output, or that operation will be uninterrupted or error-free.',
      '15.3 The warranty in clause 15.1 does not apply to any issue caused by: use outside the Specifications, Permitted Purpose or SOPs; the Client’s breach; modification of the Agent Team by anyone other than the Provider; Client Data quality; Third Party Services; or the inherent nature of AI output described in clause 11.',
    ],
  },
  {
    n: '16',
    title: 'Australian Consumer Law',
    body: [
      '16.1 Nothing in this Agreement excludes, restricts or modifies any consumer guarantee, right or remedy under the Australian Consumer Law (Schedule 2 of the Competition and Consumer Act 2010 (Cth)) (“ACL”) or any other law, to the extent it cannot lawfully be excluded, restricted or modified (“Non-excludable Rights”).',
      '16.2 To the extent permitted by the ACL, where the Services or Deliverables are not of a kind ordinarily acquired for personal, domestic or household use or consumption, the Provider limits its liability for failure to comply with a consumer guarantee (other than a guarantee that cannot be limited) to, at the Provider’s option: (a) re-supplying the Services, or supplying equivalent Services; or (b) paying the cost of having the Services re-supplied. This clause is subject to clause 16.1.',
    ],
  },
  {
    n: '17',
    title: 'Limitation of liability',
    body: [
      '17.1 This clause applies to the maximum extent permitted by law and is subject to clause 16 (Non-excludable Rights).',
      '17.2 To the maximum extent permitted by law, neither party is liable to the other for any Consequential Loss, however arising (including in contract, tort (including negligence), under statute or otherwise), even if advised of the possibility.',
      '17.3 To the maximum extent permitted by law, the Provider’s total aggregate liability arising out of or in connection with this Agreement is capped at [the total Fees paid by the Client under this Agreement in the 12 months before the event giving rise to the liability].',
      '17.4 To the maximum extent permitted by law, the Provider has no liability for loss to the extent it arises from or is contributed to by: (a) use of the Agent Team in breach of clause 9 or 10; (b) the Client’s breach, negligence or failure to follow the SOPs or maintain the Human-in-the-Loop Controls; (c) Client Data or the Client’s instructions; (d) Third Party Services; (e) reliance on AI output without the human oversight required by clause 11; or (f) anything outside the Specifications.',
      '17.5 Each party must take reasonable steps to mitigate its loss. Liability is reduced proportionately to the extent the claimant or its Personnel caused or contributed to the loss.',
      '17.6 Clauses 17.3 and 17.4 do not limit liability for: a party’s breach of confidentiality; the Client’s payment obligations; the Client’s indemnity in clause 18; or liability that cannot be limited by law (including under clause 16).',
    ],
    note: 'The cap and the carve-outs are commercial decisions. A common founder-friendly position is to cap at fees paid and exclude consequential loss, while keeping the Client’s indemnity and confidentiality uncapped. Confirm what is reasonable for your deal size with your lawyer.',
  },
  {
    n: '18',
    title: 'Client indemnity',
    body: [
      '18.1 The Client indemnifies the Provider and its Personnel against all loss, damage, liability, cost and expense (including reasonable legal costs) arising out of or in connection with:',
      '(a) the Client’s use of the Agent Team outside the Specifications, the Permitted Purpose or the SOPs, or in breach of clause 9 or 10;',
      '(b) any malicious, unlawful, fraudulent or negligent use of the Agent Team by the Client or its Personnel;',
      '(c) the Client Data, including any claim that it infringes a third party’s rights or was handled without a lawful basis or required consent;',
      '(d) the Client’s breach of this Agreement or of any law applicable to the Client’s business; and',
      '(e) any third-party claim arising from a decision, communication or action taken by the Client or its Personnel on the basis of, or with the assistance of, the Agent Team.',
      '18.2 The indemnity is reduced to the extent the relevant loss is caused by the Provider’s breach of this Agreement or its negligence.',
    ],
  },
  {
    n: '19',
    title: 'Support and the service boundary',
    body: [
      '19.1 What is covered. After Handoff, the Provider supports the Agent Team only as set out in Schedule 4, and only for matters within the Specifications and the SOPs — that is, the Agent Team operating as designed, on the data, channels and tasks it was built for, with the Human-in-the-Loop Controls in place.',
      '19.2 What is not covered. Anything outside the Specifications, the Permitted Purpose or the SOPs is not covered by this Agreement — including issues caused by use outside the Specifications, changes the Client makes, new requirements, new integrations, Client Data problems, Third Party Service changes, or use in breach of clause 9 or 10. The Provider may agree to investigate or remedy out-of-scope matters as separately quoted work.',
      '19.3 Put simply: anything within the Specifications and SOPs is handled by the Provider as agreed; anything outside them is the Client’s responsibility and is not part of this Agreement.',
    ],
  },
  {
    n: '20',
    title: 'Term and termination',
    body: [
      '20.1 This Agreement starts on the Effective Date and continues until completed in accordance with Part A, unless terminated earlier.',
      '20.2 Either party may terminate immediately by written notice if the other: (a) commits a material breach that is not remedied within [14] days of notice; or (b) becomes insolvent or subject to an insolvency event.',
      '20.3 The Provider may suspend or terminate if the Client uses the Agent Team in breach of clause 9 or 10, or fails to pay undisputed amounts when due after notice.',
      '20.4 On termination: the Client must pay for Services performed and committed costs up to termination; each party returns or destroys the other’s Confidential Information on request; and any licence to use the Agent Team ends unless otherwise agreed. The Provider may assist with an orderly wind-down at the Client’s cost.',
      '20.5 Clauses that by their nature should survive (including 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 23 and this clause) survive termination.',
    ],
  },
  {
    n: '21',
    title: 'Force majeure',
    body: [
      '21.1 Neither party is liable for a delay or failure to perform (other than a payment obligation) caused by an event beyond its reasonable control, including failures or material changes in Third Party Services, infrastructure outages, natural events, or government action. The affected party will notify the other and use reasonable efforts to mitigate. If the event continues for more than [30] days, either party may terminate by written notice.',
    ],
  },
  {
    n: '22',
    title: 'Dispute resolution',
    body: [
      '22.1 Before starting court proceedings (other than for urgent interlocutory relief), a party must give written notice of the dispute, and senior representatives of each party must meet (in person or remotely) within [10] Business Days and negotiate in good faith to resolve it.',
      '22.2 If the dispute is not resolved within [20] Business Days of the notice, either party may pursue its rights. Each party continues to perform its obligations during a dispute, except where genuinely impossible.',
    ],
  },
  {
    n: '23',
    title: 'Governing law and jurisdiction',
    body: [
      '23.1 This Agreement is governed by the laws of Victoria, Australia. Each party submits to the non-exclusive jurisdiction of the courts of Victoria and the courts that hear appeals from them.',
    ],
  },
  {
    n: '24',
    title: 'Notices',
    body: [
      '24.1 A notice under this Agreement must be in writing and sent to the relevant party’s contact in Part A (including by email). A notice is taken to be received when delivered, or for email, when sent (unless the sender receives an error), provided that notices received after 5pm or on a non-Business Day are taken to be received on the next Business Day.',
    ],
  },
  {
    n: '25',
    title: 'General',
    body: [
      '25.1 Entire agreement. This Agreement is the entire agreement between the parties about its subject matter and supersedes all prior discussions, proposals and representations. A party has not relied on any representation not set out in this Agreement.',
      '25.2 Assignment and subcontracting. The Client may not assign or novate this Agreement without the Provider’s prior written consent. The Provider may subcontract performance but remains responsible for the Services as set out in clause 3.4.',
      '25.3 Relationship. The parties are independent contractors. Nothing creates a partnership, joint venture, employment or agency relationship.',
      '25.4 Waiver and severance. A failure to enforce a right is not a waiver. If a provision is unenforceable, it is read down or severed to the minimum extent, and the rest of the Agreement continues.',
      '25.5 Publicity. Neither party may use the other’s name or logo publicly without prior written consent, except the Provider may identify the Client as a customer in general terms with the Client’s consent (not to be unreasonably withheld).',
      '25.6 Counterparts. This Agreement may be signed in counterparts, including by electronic signature, each of which is an original and together one agreement.',
      '25.7 Incorporation and execution. This Service Agreement is Annexure A to the Statement of Works. It does not require separate signature: it takes effect, and binds both parties, when the Statement of Works is executed. By signing the Statement of Works, each party agrees to be bound by this Agreement.',
    ],
  },
];

/** A Service Agreement schedule: heading + verbatim body paragraphs. */
export interface SaSchedule {
  title: string;
  body: string[];
}

export const SA_SCHEDULES: SaSchedule[] = [
  {
    title: 'Schedule 1 — Specifications',
    body: [
      'The Specifications for the Agent Team are set out in the Statement of Works for the engagement (to which this Service Agreement is Annexure A). The Statement of Works is derived from the Client’s Modelling Phase Blueprint and records what the Agent Team is and does. To avoid duplication, the Specifications are not repeated here; the Statement of Works prevails on the description of the works (clause 2.2).',
      'Where the Statement of Works uses the Provider’s internal pipeline vocabulary, that vocabulary has the meaning given in the Statement of Works and clause 1. The Specifications include at least the following elements: Permitted Purpose and scope statement (Scope of Works overview); included capabilities (In scope; capability schedule); excluded capabilities (Out of scope); the Agent roster and roles (The Agent Team); allocation per capability (capability schedule allocation column); Human-in-the-Loop Controls and held-human decisions (capability schedule human handoff); benchmarks and targets (Targets); integrations and Connectors (Infrastructure and integrations); and build phases, work plans and timeline (Approach, build phases and timeline).',
    ],
  },
  {
    title: 'Schedule 2 — Fees and payment',
    body: [
      'The commercial terms for this engagement are set out in the Fees section of the Statement of Works. Amounts are exclusive of GST unless stated. Milestones: Build commencement on execution / Gate 03; Handoff on acceptance / Gate 04; Support (if any) as agreed; third-party pass-through (hosting, model usage) as incurred or included; out-of-scope and change requests as separately quoted.',
      'Invoicing follows the Statement of Works. Payment terms: as set out in the Statement of Works. Currency: AUD.',
    ],
  },
  {
    title: 'Schedule 3 — Standard Operating Procedures (SOPs) and operating constraints',
    body: [
      'The Provider will supply SOPs for the operation of the Agent Team. The Client must train its Personnel on, and operate strictly in accordance with, the SOPs and the operating constraints below. The SOPs form part of the Specifications for the purposes of clauses 9, 10, 11 and 19.',
      'The SOPs will typically cover: (a) how each Agent is to be used, and the data, channels and tasks it is built for; (b) the Human-in-the-Loop Controls, which outputs require human review or approval before use, and which decisions are held human; (c) confidence thresholds and fallback handling (when items go to a human queue rather than auto-proceed); (d) escalation and exception handling, and who is accountable; (e) what the Client must not do (see clauses 9 and 10); and (f) monitoring, logging and review expectations.',
    ],
  },
  {
    title: 'Schedule 4 — Service boundary and support',
    body: [
      'This Schedule defines what is in scope for support after Handoff. It operationalises clause 19. Anything not listed as in scope is out of scope and is the Client’s responsibility unless separately agreed.',
      'In scope (covered): the Agent Team operating as designed on specified data, channels and tasks; defects against the Specifications reported within the agreed window; maintaining the configuration delivered at Handoff; the agreed support hours and response targets; and bug fixes within the agreed support period.',
      'Out of scope (not covered): use outside the Specifications, Permitted Purpose or SOPs; new capabilities, channels, integrations or requirements; changes the Client makes to the configuration or environment; issues caused by Client Data, Third Party Services or breach of clause 9 or 10; and out-of-scope investigation or rework (separately quoted).',
    ],
  },
];
