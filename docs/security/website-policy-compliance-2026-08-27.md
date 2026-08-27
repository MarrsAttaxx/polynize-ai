# polynize.ai against the Polynize policy packet

**Audited:** 27 August 2026
**Against:** `polynize.io-2026-08-17-policy-packet.pdf`, 16 policies, 64 pages
**Scope:** the polynize.ai web application in this repository. The marketing site, the
three funnels (`/map-your-team`, `/job-mapping`, `/capability-mapping`), `/links`, and the
data they collect. Also the shared infrastructure those depend on.

**Out of scope:** the PAM Console (`app/console/`) and `lib/marketing/`, which another
agent owns, except where a control I audited reaches into them. `graph.polynize.ai` is a
separate repository and is noted only where it shares an account with polynize.ai.

---

## How this was tested

Not read off the code and assumed. Where a control was testable I tested it:

- TLS and security headers pulled live from `https://www.polynize.ai`
- `robots` meta fetched live from two real blueprint permalinks
- Table definitions and RLS read from the migrations, cross-checked between siblings
- Log statements grepped for PII interpolation
- CI workflow and `package.json` scripts read directly
- Git history queried for change-control evidence

Nine findings below have a reproducible command or a quoted line behind them. Three
observations are marked as unverified because I could not test them from here.

---

## Summary

| # | Finding | Severity | Policy |
| --- | --- | --- | --- |
| H1 | Shared blueprints are unauthenticated **and** indexable, and contain Customer Data | **High** | Data Management |
| H2 | No retention period and no deletion for any PII the site collects | **High** | Data Management |
| H3 | No way for a data subject to request deletion | **High** | Data Management |
| H4 | Every production deploy is direct to `main` with no reviewer | **High** | Secure Development |
| M1 | Email addresses written into application logs in five places | Medium | Operations Security |
| M2 | `job_blueprints` has no RLS, unlike both sibling tables | Medium | Secure Development |
| M3 | No privacy notice anywhere on a site that collects name, email and free text | Medium | Data Management, and law |
| M4 | No published channel for the incident address the IR plan relies on | Medium | Incident Response |
| M5 | CI explicitly disables the only dependency scan available | Medium | Operations Security |
| M6 | No Release Checklist, which the policy says MUST be completed | Medium | Secure Development |
| L1 | Only one security header set | Low | Secure Development |
| L2 | My own test rows are sitting in production tables | Low | Secure Development |
| L3 | 30 day session against a 2 hour policy figure | Low, needs a ruling | Operations Security |
| L4 | Magic link is a single factor | Low, needs a ruling | Access Control |
| L5 | No third-party register or evidence of DPAs | Low, needs evidence | Third-Party Management |

Nothing here is an active breach. H1 is the only finding where data could reach someone
who should not have it without a further mistake, and it needs a crawler to find a shared
link first.

---

## High

### H1. A shared blueprint is public, unauthenticated, and indexable

Two clauses, both from the Data Management Policy, and the blueprint content is squarely
inside its own definition of Confidential ("Customer Data", "Personally identifiable
information (PII)"):

> Confidential systems shall not allow unauthenticated or anonymous access

> Confidential data shall be encrypted at rest and in transit over public networks

A blueprint at `/map-your-team/<uuid>` renders a named client, their bottleneck in their
own words, their capability map and their benchmark. It requires no authentication, which
is deliberate: the Share button exists so a client can send it to their team.

The part that is not deliberate is that **the page carries no `robots` directive.**
Verified live:

```
/map-your-team/21b4c4b8-...  ->  NO ROBOTS META (indexable)
/job-mapping/2ea4cba0-...    ->  <meta name="robots" content="noindex, nofollow">
```

`robots.txt` disallows only `/proposals/`. So a blueprint link pasted into anything a
crawler can reach becomes a search result containing a client's confidential business
detail. The uuid is unguessable, which is the only thing standing between this and
disclosure, and "security by obscurity" is one of the ten secure-by-design principles this
policy tells us to avoid.

**Fix, in two parts.** The cheap half today: add `robots: { index: false, follow: false }`
to `/map-your-team/[id]` and `/blueprints/[id]`, matching what `/job-mapping/[id]` already
does, and add both paths to `robots.txt`. That closes the indexing exposure entirely.

The other half is a decision, not a bug. An unauthenticated URL holding Customer Data
contradicts the policy as written, and the product depends on it. The policy anticipates
exactly this: *"Requests for an exception to this Policy must be submitted to the CISO for
approval."* Either file that exception and record the compensating controls (unguessable
identifier, noindex, no listing endpoint, revocation on request), or move shared blueprints
behind the same magic-link gate the Console uses. **Do not leave it undocumented,** which
is the current state.

### H2. Nothing the site collects has a retention period

The Data Management Policy is at v2.0, dated 12 August 2026, so this is current thinking
rather than legacy:

> Personally identifiable information (PII) shall be deleted or de-identified as soon as it
> no longer has a business use.

> Retention periods shall be documented in the Data Retention Matrix in Appendix B to this
> policy.

Three production tables hold PII from the public site:

| Table | PII held | Retention today |
| --- | --- | --- |
| `leads` | email, name, business | indefinite |
| `sales_blueprints` | client name, session content | indefinite |
| `job_blueprints` | name, email, generated job map | indefinite |

**Appendix B contains no row for any of them.** Its rows cover SaaS products, AutoSupport,
support tickets, security events, vulnerability scans, sales data, QA data, security
policies and temp files. The website funnels are simply absent, so there is no documented
period to comply with and nothing to measure against.

There is also no mechanism. I searched for any scheduled deletion, TTL or purge touching
these tables and found none.

**Fix.** Two things, and the first is Marrs and Julian's, not mine. Add rows to Appendix B
for website leads and generated blueprints with a decided period. Then I can implement it:
a scheduled job that deletes or de-identifies past the period. `app/api/cron/` already
exists as a home for it.

A reasonable starting proposal, for them to accept or change: leads 24 months from last
contact, blueprints 12 months from creation, and de-identify rather than delete a blueprint
so the aggregate stays useful.

### H3. A data subject cannot ask us to delete their data

> PII shall also be deleted in response to a verified request from a consumer or data
> subject, where the company does not have a legitimate business interest or other legal
> obligation to retain the data.

There is no route, no form, no email address published on the site, and no documented
internal procedure for honouring such a request. Someone who used `/job-mapping` and wants
their email removed has no way to ask and we have no way to act.

**Fix.** A published address is enough to start, and it belongs on the same page as H3's
privacy notice. The deletion itself is a query. What matters is that the request has
somewhere to land.

### H4. Every deploy goes straight to production with no reviewer

The Secure Development Policy is explicit, twice:

> Significant code changes must be reviewed and approved by a reviewer before being merged
> into any production branch

> Change control procedures shall ensure that development, testing and deployment of
> changes shall not be performed by a single individual without approval and oversight.

And Operations Security:

> Changes with substantial impact on information security and operational functionalities,
> must obtain formal authorization before deployment.

**Measured:** 11 commits to `main` in the last seven days. **Zero pull requests have ever
been opened on this repository.** Every one was committed, pushed to `main`, and
auto-deployed to production by a single actor with no second pair of eyes.

I should be plain that this includes my own work. Everything I shipped in this session went
that way, including changes to authentication-adjacent code, a new public funnel that
collects PII, and a database migration. Two defects reached production and were caught by
me afterwards rather than by review: a foreign-key violation that silently discarded every
lead, and a fire-and-forget promise that never executed.

There is a real mitigation worth crediting: CI typechecks and builds on every push, and a
`prebuild` check fails the build on an undefined CSS class. But CI runs **on push to
`main`**, which is after Vercel has already begun deploying. It is a detector, not a gate.

**Fix.** This is a workflow decision for Marrs, and the honest options are not equal:

1. **Branch protection on `main`,** PRs required, CI as a required status check. Fully
   compliant. Costs a review step on every change, which with one human and several agents
   may be unworkable.
2. **Keep direct pushes and make CI a real gate,** by having Vercel deploy only on a
   successful CI run rather than on push. Partial compliance: still no human reviewer, but
   no longer "deployment by a single individual without oversight" in the automated sense.
3. **File a documented exception with the CISO** stating the compensating controls, which
   is what the policy provides for and what the current state amounts to without the
   paperwork.

My recommendation is 2 plus 3 now, and 1 when there is a second reviewer available. What
should not continue is the present position, which is non-compliance with no exception on
file.

---

## Medium

### M1. Email addresses are written into logs

> Logs must be stored for at least 30 days, and should not contain sensitive data or
> payloads

Five sites interpolate an email address into a log line that lands in Vercel's log store:

```
app/api/job-map/start/route.ts:102   lead capture failed for ${body.email}
lib/leads.ts:113                     new lead ${email}; pinged ...
lib/resend-client.ts:42              Skipping send to ${to} (subject: ${subject})
app/console/leads/[owner]/fireflies/route.ts:186   could not add ${c.email}
app/api/blueprints/route.ts:117      (session id only, acceptable)
```

The first is mine, added today. Emails are PII and therefore Confidential, and Vercel's log
retention is not the 30 days this policy assumes nor under our control.

**Fix.** Log the row id, and where a human needs to identify the record, a hashed or masked
address (`m***@polynize.io`). The Ops policy's own data-masking section endorses exactly
this: *"replacing values with their hashes"*. Four one-line changes, three of which are in
my area. The fireflies one is in the Console and belongs to the other agent.

### M2. `job_blueprints` has no row level security

Both sibling tables enable it explicitly:

```sql
-- 0010_sales_blueprints.sql
alter table sales_blueprints enable row level security;
-- 0011_leads.sql
alter table leads enable row level security;
-- 0013_job_blueprints.sql
(nothing)
```

Migration 0013 is mine and I omitted it. Secure-by-design principle 2 in this policy is
"Establish secure defaults", and the house default here is visibly the other two tables.

**Real exposure today is low, and I would rather say so than inflate it.** This application
never ships a Supabase client to the browser: the anon key appears exactly once in the
codebase, as a boolean in a diagnostics route. Every database call goes through a server
route with the service role key, which bypasses RLS anyway. So RLS is defence in depth here
rather than the thing standing between the table and the internet.

It should still be on, because the day someone adds a client-side Supabase call is the day
it matters, and that person will reasonably assume the table is protected like its
siblings.

**Fix.** One line, and it needs Marrs to run it since it is a migration:
`alter table job_blueprints enable row level security;`

### M3. There is no privacy notice on the site

The site collects, across three funnels: name, email address, a free-text description of a
business bottleneck, and a pasted job description. All of that is PII or close to it, and
the Data Management Policy classifies PII as Confidential.

There is no `/privacy` route, no privacy policy, and no privacy notice. The footer links
`polynize.io/misc/tos.pdf`. `/job-mapping` carries one honest line, *"We do not keep your
job description. It is used to build the map and then dropped"*, which is genuinely good
practice and is the only privacy statement anywhere on the site.

Two reasons this is a finding rather than a nicety. The policy's privacy-by-design
principles include *"Visibility and Transparency, Keep it Open"* and *"Respect for User
Privacy, Keep it User-Centric"*. And separately from the policy packet, an Australian
entity collecting personal information generally needs a privacy policy and needs to tell
people what it collects and why. **I am not the right adviser on the legal question and
this should go past whoever handles it.**

**Fix.** A `/privacy` page saying what each funnel collects, why, how long it is kept
(needs H2 decided first), who it goes to (needs M5 listed), and how to ask for deletion
(H3). Linked from the footer and from each funnel's form.

### M4. The incident channel is not published anywhere a reporter can find it

The Incident Response Plan and the AUP both route reports to `security@polynize.io`, and
the IR plan explicitly expects reports from outside:

> If a Polynize Pty Ltd employee, contractor, user, **or customer** becomes aware of an
> information security event ... they shall immediately report

There is no `/.well-known/security.txt`, and the address appears nowhere on the site. A
researcher who finds something has no documented way to tell us, and the usual outcome is
that they post it publicly instead.

**Fix.** A `public/.well-known/security.txt` with the contact address, a preferred
language, and an expiry date. Twenty minutes, and it is the cheapest item on this list
relative to what it prevents.

### M5. CI turns off the only dependency scan it has

Operations Security, Appendix A, CI/CD Security:

> Dependency Scanning: Scan for vulnerable dependencies during build

And Secure Development lists *"Prevention of the use of vulnerable libraries"* among the
threats developer training must cover.

`.github/workflows/ci.yml` installs with:

```yaml
run: npm ci --no-audit --no-fund
```

`--no-audit` explicitly suppresses the advisory check. So the pipeline currently has no
dependency scanning of any kind, and it got there by a deliberate flag rather than an
omission. There is no Dependabot config either.

**Fix.** Add an `npm audit --audit-level=high` step that fails the job, and enable
Dependabot security updates. Keep `--no-audit` on the install itself, since install-time
audit output is noise; the point is a separate step whose result is a pass or a fail.

### M6. There is no Release Checklist

> Prior to deploying code, a Release Checklist MUST be completed which includes a checklist
> of all Test Plans which show the completion of all associated tests and remediation of
> identified issues.

And:

> No code shall be deployed to Polynize Pty Ltd production systems without documented,
> successful test results and evidence of security remediation activities.

No such checklist exists, and there is very little to put on it: the only test files in the
application are under `lib/blueprint/__tests__`. Nothing in `lib/marketing` is tested, and
the marketing funnels I built this session have no automated tests at all. `MUST` is the
policy's own emphasis.

**Fix.** A short `docs/release-checklist.md` that a deploy actually references, listing
what genuinely runs today (typecheck, build, CSS module check, a manual production
verification) and what is missing. An honest checklist that says "no automated tests cover
this path" is worth more than no checklist, and it makes the gap visible instead of
implied.

---

## Low, and three that need a ruling rather than a fix

### L1. One security header

Live response headers from `https://www.polynize.ai`:

```
strict-transport-security: max-age=63072000
```

That is it. No `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy` or `Permissions-Policy`. The Secure Development Policy names prevention
of XSS, CSRF and injection as things development must address; CSP and frame options are
the standard header-level contribution to that.

HSTS itself is set well, at two years.

**Fix.** A `headers()` block in `next.config.mjs`. CSP needs care because the site uses
inline styles and Vercel Analytics, so start in report-only mode.

### L2. My test rows are in production tables

I created `jobmap-test@polynize.ai` and `jobmap-test2@polynize.ai` rows in `leads` and
`job_blueprints` while testing the funnel end to end, plus one `job_blueprints` row against
Marrs's own address. The Secure Development Policy's "Protection of test data" section
expects test data to be selected, protected and controlled.

Already flagged to Marrs with the deletion statement. Listed here so it is on one page with
everything else. The `leads` row matters more than the blueprint rows, because a fake
address in the CRM will be swept into the kit.com sync when that is wired.

### L3. A 30 day session against a 2 hour figure

Operations Security, Appendix A: *"Remote access sessions must be configured to enforce
timeout after a specified period of 2 hours."*

The Console session cookie is 30 days (`lib/console-auth.ts`, `COOKIE_MAX_AGE_DAYS = 30`).

**This needs a ruling, not a change.** That clause sits in the Network Standards section
among firewall and NAT requirements, so it reads as being about VPN and network-level remote
access rather than an application session. If it does cover application sessions, 30 days
is a long way outside it and the Console is the wrong place for me to change anyway. Worth
Julian clarifying which reading is intended, because the same question will apply to
`graph.polynize.ai`.

### L4. Magic link is a single factor

Access Control: *"All privileged access to production infrastructure shall use Multi-Factor
Authentication (MFA)"*, and *"Enforce Strong Authentication: Require MFA for all privileged
access."*

Console sign-in is a magic link: possession of an email account, one factor. Whether the
Console counts as "production infrastructure" is the question. It is a production
application holding client engagement data, so I would expect it to, but that is Julian's
call.

Worth noting what magic links do well against this packet: there are no passwords stored
anywhere, so the entire Password Policy and the bcrypt/Argon2 requirement in the
Cryptography Policy are satisfied by having nothing to satisfy them with. Adding a second
factor is the gap, not replacing the mechanism.

### L5. No third-party register, and the LLM path is the one to look at

Third-Party Management Policy:

> Polynize Pty Ltd shall not share or transmit Confidential data to a third-party without
> first performing a third-party risk assessment and fully executing a written contract,
> statement of work or service agreement

The site transmits visitor-supplied content or PII to:

| Third party | What reaches them |
| --- | --- |
| Vercel | all traffic, all logs, hosting |
| Supabase | every stored lead, blueprint and job map |
| Resend | recipient email addresses and email bodies |
| **OpenRouter, and through it an LLM provider** | **pasted job descriptions and bottleneck answers verbatim** |
| Vercel Analytics | page-level visitor analytics |

I cannot see contracts or DPAs from here, so this is flagged as unverified rather than
failed. The one worth attention is OpenRouter. A pasted job description goes to a
third-party model provider in full, and `/job-mapping` tells the visitor *"We do not keep
your job description"*, which is true of us and silent about the model. That statement is
not dishonest, and it is also not the whole path. Once M3's privacy notice exists, the AI
sub-processor belongs in it.

---

## What is compliant, and worth not breaking

Credit where the code already does the right thing, because an audit that only lists faults
gets ignored.

**Cryptography Policy: passes, with room to spare.** The requirement is *"Ciphers of B or
greater grade on SSL Labs Rating"*. Measured live: TLS 1.3, `TLS_AES_128_GCM_SHA256`, valid
certificate chain, verify code 0. HSTS at two years. Data at rest is AES-256 by Supabase
and Vercel default, which satisfies the at-rest row by inheritance (unverified from here,
but it is the providers' documented default).

**`/job-mapping` not storing the job description is the best privacy decision in the
codebase.** Migration 0013 has no column for it, deliberately, and the comment says why. It
satisfies *"PII shall be deleted or de-identified as soon as it no longer has a business
use"* by never retaining it, and *"Privacy as the Default Setting"* by construction. It is
also stated to the user on the page and in the email. That is the standard the other two
funnels should be measured against.

**`/job-mapping/[id]` is noindex.** The route is indexed, individual people's job maps are
not. Exactly the right split, and the reason H1 stands out by contrast.

**No secrets reach the browser.** No `NEXT_PUBLIC_` variable carries a credential. The
Supabase anon key exists only as a boolean in a diagnostics route. Every privileged call is
server-side.

**RLS on `leads` and `sales_blueprints`,** with no public policy, so the anon key cannot
read them even if it leaked.

**The lead is captured before generation runs** in `/job-map/start`, so a model failure
cannot cost the record. That is "Fail securely" applied to the commercially important path.

**The exposure read on a job map is a word and a sentence, never a score.** The prompt
forbids a number. That is a deliberate choice not to invent precision about someone's
livelihood, and it is the privacy-by-design principle *"Respect for User Privacy"* doing
real work rather than being cited.

**CI runs typecheck and build on every push and every PR,** and `prebuild` fails on an
undefined CSS-module class. That check has caught six real defects including two of my own.
It is not the Release Checklist the policy asks for, but it is a genuine automated gate.

---

## What I could not verify

Stated plainly so nobody reads a silence as a pass.

1. **Contracts and DPAs** with Vercel, Supabase, Resend, OpenRouter and Metricool. Not
   visible from the repository.
2. **Encryption at rest** is the providers' default and I did not confirm it on our
   specific instances.
3. **Whether Vercel log retention meets the 30 day minimum**, and whether logs are
   protected against tampering as the policy requires.
4. **Backups and restore testing** for Supabase. The policy wants annual restore tests and
   backups in a separate region.
5. **Annual penetration test and vulnerability scan** of public-facing systems. The policy
   requires both annually. I found no evidence either way.
6. **MFA on the Vercel, Supabase, Resend and OpenRouter accounts themselves.** Account level
   and not visible from here, and more consequential than anything in the application.

Items 5 and 6 are the two I would chase first, because they are cheap to establish and both
sit above the application in the risk stack.

---

## Suggested order

**This week, and small.** L1 headers, M4 `security.txt`, H1's noindex half, M2's one line of
SQL, M1's five log lines. Half a day in total and it closes the only finding with a
disclosure path.

**Needs a decision before I can build.** H2 retention periods into Appendix B. H4's change
control option. H1's exception or gate. M3's privacy notice content, which depends on H2 and
M5.

**Then.** M5 dependency scanning, M6 the checklist, H3 the deletion path, and the six
unverified items.

---

## One thing about this report

Four of these findings are mine. H4 describes a process I used about thirty times in the
last day. M2 is a line I left out of my own migration. M1's first entry is a log line I
added this morning. L2 is my test data.

I have not softened them for that reason, and I have not inflated the rest to balance it.
Where the exposure is genuinely low, such as M2, the report says so.
