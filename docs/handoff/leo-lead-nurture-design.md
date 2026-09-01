# Design brief: lead nurture through Leo and Kit

**For:** the PAM Console agent, and Leo for comment
**From:** the polynize.ai site session
**Date:** 27 August 2026
**Status:** design, nothing built. Two prerequisites sit in the public site and are mine.

---

## The decision, in one line

**Leo writes, Kit sends, a human approves, and every lead gets a floor.**

Marrs was weighing Kit sequences against Leo doing bespoke outreach. They are not
alternatives. Kit is a sending and compliance layer: deliverability, unsubscribe, list
hygiene, bounce handling, engagement reporting. Leo is a judgement layer: reading what the
person's own blueprint says and deciding what they need. Use each for what it is good at.

---

## Why this is not ordinary nurture

Normal nurture buckets a stranger by a persona guess. We have something much stronger and
the design should be built around it: **we already made this person a document about their
own problem, and they read it.**

From `/map-your-team`: their business, their bottleneck in their own words, the capability
map, the benchmark and the gap.
From `/job-mapping`: their job title, seniority, function, which capabilities the map put
in the human lane, their exposure level, and what it told them to learn next.

That means the first Leo touch can be specific in a way no sequence can be. Not
`{{first_name}}`, but "your map put commercial structuring in the human lane and forecasting
in hybrid, and the people we see in that position usually hit X next".

**Design consequence:** Leo's input is the blueprint, not a persona label. The label is for
Kit's segmentation. The blueprint is for the writing.

---

## The shape

```
magnet completed
  -> leads row written (already exists, needs 3 new fields)
  -> blueprint delivered            [Resend, transactional, EXISTING, do not touch]
  -> pushed to Kit with segment     [NEW]
  -> Kit generic lane sequence runs [NEW, the floor: everybody gets this]
  -> Leo scores the lead            [NEW]
       cold  -> nothing further. The sequence is the whole treatment
       warm  -> Leo drafts a specific message
                 -> Console approval queue
                 -> Marrs approves or edits
                 -> Kit sends it as a one-off to that subscriber
                 -> Reply-To is Marrs. Conversation becomes human from here
```

### The one thing I would change from Marrs's framing

He described it as warm leads get Leo, cold leads get a generic Kit stream. I would make it
**everyone gets the Kit stream, and Leo adds a layer on top of the warm ones.**

The difference matters when scoring is wrong, which it will be early. Under "warm gets Leo,
cold gets Kit" a misscored lead still gets something. Under "Leo or nothing" a scoring bug
means a real buyer gets silence and you never find out. Kit as the floor means the failure
mode is a slightly generic email rather than no email.

It also means you can ship the Kit half first and add Leo second, which given volume is
currently one lead a week is the right order anyway.

---

## Hard constraint: Leo has no mailbox

Marrs is explicit and it shapes everything:

> putting agents into our email flow, into our Google account, is a big no-no. Really,
> that's not gonna happen

So **Leo is write-only on email.** He drafts; he never reads a reply. Replies go to Marrs,
cc Leo is not possible in the usual sense because there is no Leo inbox to cc.

Three consequences the build must respect:

1. **Sending identity is a Kit sending identity, not a Google mailbox.** Kit sends as Leo
   with `Reply-To: marrs@polynize.io`. The DNS records for that identity are a Marrs task.
2. **The conversation hands over the moment someone replies.** Leo warms, a human closes.
   That is the correct handover point anyway, so this constraint is not costing much.
3. **Do not design any flow that assumes Leo can see a thread.** No follow-up-if-no-reply
   logic based on inbox state. If reply awareness is wanted later, the path is a Kit-side
   webhook or a forwarding alias into the Console, never a Workspace account.

### The sender-identity question, which needs a ruling

Marrs chose Leo over a brand name, and the reasoning is sound: a person outperforms a logo.

But Leo is an agent, and the recipient will read the name as a colleague. Sending
commercial email under a name a recipient reasonably believes is a person, when it is not,
is a misrepresentation risk, and the Spam Act 2003 requires accurate sender identification.

**Recommendation, not a decision:** send as `Leo at Polynize`, and put one honest line in
the footer, something like *"Leo is Polynize's lead agent. Replies reach Marrs directly."*
That keeps the specific-individual benefit, is accurate, and turns a liability into a
differentiator for a company whose entire thesis is humans amplified by agents. Hiding it
would be off-message as well as risky.

Marrs and Julian to rule.

---

## Two prerequisites, and both are in my area

Neither is optional. The design does not work without them, and neither is in the Console.

### P1. Lane attribution: we cannot currently tell which lane a lead came from

This is the important one and it is not obvious.

The content strategy defines six lanes with six Kit segments. But look at what the magnets
map to:

| Lane | Segment | Magnet |
| --- | --- | --- |
| AI capability | `ai_capability_lead` | Map your team |
| Sales capability | `sales_lead` | Capability map your team |
| Leadership development | `ld_lead` | Capability map your team |
| Hiring assessment | `hiring_manager` | Map a bottleneck |
| Cybersecurity | `security_lead` | TO BUILD |
| Acquisition diagnostic | `deal_side` | undefined |

**Four lanes resolve to the same magnet.** So the magnet cannot tell you the segment. A
completion of `/map-your-team` might be `ai_capability_lead`, `sales_lead`, `ld_lead` or
`hiring_manager`, and today the `leads` row records only `source: 'blueprint'`.

I checked: **there is no UTM or referrer capture anywhere in either funnel.** So the
information that would resolve the lane, which post sent them, is discarded at the door.

**Fix, mine:** capture `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` and the
referrer on funnel entry, persist through the flow, and write them to the lead. Then the
lane comes from `utm_campaign` set per lane by the posting side.

**Fallback, Leo's:** for organic arrivals with no UTM, Leo infers the lane from the
blueprint content, the stated business and the role, and writes a confidence with it. Store
both, so a human can see when the lane was guessed.

### P2. Share and open attribution on the blueprint

The strategy makes this the trigger for the entire funnel:

> **Every lead magnet also writes the buyer brief.** That's the piece the doer forwards to
> their boss, and it's why this works without us ever reaching the boss directly.

and, on the discovery call stage:

> Triggered when they forward the buyer brief, or book directly off the result

**We cannot currently detect a forward.** `/map-your-team/[id]` has no view tracking and no
share attribution. The single strongest buying signal in the whole model, a blueprint being
opened by five people at one company in two days, is invisible.

**Fix, mine:** count distinct views per blueprint, timestamped, with a coarse fingerprint
that does not identify individuals. Expose it on the lead so Leo can score against it.

Two notes. Do this **after** the noindex fix from the compliance audit (finding H1), or the
first thing you will count is Googlebot. And keep the fingerprint coarse and documented in
the privacy notice, because we are counting readers of a document, not tracking people.

### A third gap that is nobody's yet: the buyer brief does not exist

The strategy leans on the buyer brief at stage 03 of all six lanes and calls it the reason
the model works without reaching the boss directly. **Nothing in the codebase generates
one.** `/map-your-team` produces a blueprint and `/job-mapping` produces a job map; neither
produces a separate document addressed to the buyer in the buyer's language.

Not in this brief's scope. Flagging it because the nurture design assumes it exists, and
several lanes' discovery-call triggers depend on it.

---

## Data model

### Changes to `leads` (mine, migration needed)

```sql
alter table leads
  add column if not exists lane            text,     -- one of the six segment ids
  add column if not exists lane_confidence text,     -- 'utm' | 'inferred' | 'unknown'
  add column if not exists utm             jsonb,    -- source, medium, campaign, content, referrer
  add column if not exists score           int,      -- 0-100, Leo writes
  add column if not exists score_reason    text,     -- why, in one sentence, for the human
  add column if not exists tier            text,     -- 'hot' | 'warm' | 'cold'
  add column if not exists kit_subscriber_id text;
```

`synced_at` already exists and was designed for exactly this: *"When this lead was pushed
to kit.com. Null = not yet synced."* Use it as intended.

`email` is `unique`, so a person who completes two magnets updates one row. Good for
identity, but it means a second completion must be visible as a signal rather than
overwriting the first silently. Suggest a separate `lead_events` table rather than
stretching `leads`.

### New: `lead_events` (Console)

One row per thing the lead did: magnet completed, blueprint viewed, blueprint viewed by
someone else, Kit email opened, Kit link clicked, Leo message sent, reply received (entered
by Marrs), call booked. This is what scoring reads, and it is what makes the score
explainable rather than a number that appeared.

### New: `lead_messages` (Console)

Leo's drafts and their approval state. `draft | approved | edited | rejected | sent`, plus
the final text as sent, the Kit broadcast id, and who approved. This is the audit trail and
it is also the training signal: what Marrs edits tells Leo what he is getting wrong.

---

## Scoring

Lean on observed behaviour over model inference. Leo is good at reading a blueprint and
bad at knowing whether someone is a buyer.

**Strong signals, all behavioural:**
- Blueprint opened by more than one distinct viewer, and how many, and how fast (P2)
- A second magnet completed
- Kit sequence opens and clicks
- Seniority and function from the job map, where the magnet was `/job-mapping`
- A named business rather than a blank or a personal address

**Weak signals, use with care:**
- Leo's read of how specific and painful the stated bottleneck is. Useful, but it rewards
  people who write well rather than people who buy.

**Tiers should be a budget, not a threshold.** At one lead a week Marrs reads every one; at
five hundred a week he reads none. Define the tiers as "the top N per week get a Leo draft",
where N is what a human will actually approve, and let the score rank rather than gate.
That way the system stays sane across three orders of magnitude of volume, which is exactly
the range between now and the month-6 target.

---

## Approval

Marrs confirmed: **yes, a human approves.**

- Leo drafts into a Console queue. Nothing leaves without a click.
- The reviewer sees the draft, the lead's blueprint, the score and its reason, side by side.
  Approving without being able to see why Leo said what he said is rubber-stamping.
- Edits are captured, not just the final text. The diff between draft and sent is the most
  valuable data in this whole system.
- Rejections need a one-word reason. Three or four fixed options is enough.

**When to relax it:** after fifty approvals, look at the edit rate per tier. If the cold and
warm tiers are going out unedited, auto-send those and keep approval for hot. Do not relax
it on a date; relax it on evidence.

---

## Build order

Small to large, and each step is useful on its own.

1. **P1 UTM capture** (mine). Without it every lead is unattributed and Kit segmentation is
   guesswork. Half a day.
2. **Kit connection and push** (Console). `leads` to Kit subscriber with segment and custom
   fields, `synced_at` set. Backfill existing leads. This alone gives Marrs the newsletter
   he wants.
3. **The six Kit sequences** (Marrs, in Kit). Not a build task. Generic per lane, and they
   are the floor.
4. **P2 share attribution** (mine, after the H1 noindex fix).
5. **`lead_events` and scoring** (Console). Rules first, no model. Get the signals flowing
   and see what correlates before asking Leo to judge.
6. **Leo drafting and the approval queue** (Console). Last, because it is the highest risk
   and it depends on everything above.

At one lead a week, steps 1 to 3 may be the entire system for a while, and that is a
perfectly good outcome.

---

## Compliance, briefly, because it is real

Three things that must be in the build rather than added after.

1. **Consent and unsubscribe.** Kit handles unsubscribe, footers and suppression, which is
   most of the reason to use it. But the funnel forms currently carry **no consent language
   and the site has no privacy notice at all** (finding M3 in the compliance audit). Adding
   nurture makes that gap material. The privacy notice is a prerequisite for step 2, not a
   follow-up.
2. **Deliverability separation.** Nurture must not send from the same identity as Console
   sign-in and blueprint delivery. Those are transactional emails people are waiting on, and
   a spam complaint against nurture should not touch them. Kit sending from its own
   infrastructure gives this separation, which is another reason not to have Leo send
   through Resend.
3. **Third-party transfer.** Pushing lead PII to Kit is a transfer of Confidential data
   under the Third-Party Management Policy, which requires a risk assessment and an executed
   written agreement first. One vendor, small task, worth doing before the first push rather
   than after.

---

## What I need back

For Leo, or whoever picks this up:

1. Does the scoring shape above match what Leo can actually do, and what signals would he
   want that are not listed?
2. Is the draft-to-approval-queue interaction workable in the Console as it stands, or does
   it need a surface that does not exist yet?
3. Is `lead_events` the right grain, or does the CRM already have somewhere for this?

For Marrs:

4. Sender identity ruling: is the Leo footer disclosure acceptable?
5. Which of the six lanes go live first? The strategy marks three "go hard" and two "light",
   and building six sequences for one lead a week is premature.
6. Confirm the Kit segment ids so the code matches the strategy exactly:
   `ai_capability_lead`, `sales_lead`, `ld_lead`, `security_lead`, `hiring_manager`,
   `deal_side`.

---

## Boundary note

Steps 1 and 4 are in the public site and are mine to build whenever Marrs says go.
Everything else is Console and belongs to the agent this brief is addressed to. I have not
touched `app/console/` or `lib/marketing/` and will not.
