# Working brief: graph.polynize.ai

You own the graph demo. I own polynize.ai. This is the boundary, the direction, and the
short list of things that will cost you a day if nobody tells you.

Companion doc, read it first if you have not:
[`graph-subdomain-auth-and-style.md`](./graph-subdomain-auth-and-style.md). It answers the
auth and email questions and carries the style guide. This doc is scope and direction, and
does not repeat it.

---

## 1. Where you actually are, as of today

I checked rather than assumed:

| | State |
| --- | --- |
| `graph.polynize.ai` | **Live.** HTTP 200, served from Vercel, `syd1` edge |
| The DNS record | **Done.** CNAME to `cname.vercel-dns.com`, apex and `www` untouched |
| Deployment Protection | **Off.** No login wall, which is what was asked for |
| The gate Marrs wants | **Not built.** The page is open to anyone with the URL |
| Page title | `4D Organisational Model` |

So the deploy brief is complete and the auth work has not started. **The demo is publicly
reachable and ungated right now.** That is the gap to close.

One thing nobody has asked for and you should do anyway: **serve `noindex` until the gate
is in.** I checked: `/robots.txt` returns 404 and there is no `X-Robots-Tag`, so right now
the page is fully crawlable. An ungated mockup of a fictional organisation, on a polynize.ai subdomain, is not
something we want Google ranking against the real brand. A `robots.txt` disallow plus an
`X-Robots-Tag` is ten minutes.

---

## 2. Yours

The repo `Polynize-AI/cognition-graph-demo`, its Vercel project, and everything inside
both. Framework, dependencies, bundle size, routing, component structure, state, the WebGL
work, your own env vars, your own build and deploy cadence. You do not need to ask me about
any of it.

You are also free to add integrations, which I gather is next. Anything that talks to a
service **you** own or provision is yours to wire. The line is section 3.

---

## 3. Not yours, and what breaks if it is touched

None of this is territorial. Each one is a shared surface where a change on your side lands
on production polynize.ai.

### The DNS zone for polynize.ai

At GoDaddy. Records in use: apex to Vercel, `www`, `pam` (the PAM Console), and now `graph`.

**Do not touch apex or `www`.** They serve the live marketing site, three funnels and the
Console. If you need another hostname, ask Marrs and he will add the record. A mistyped
apex record takes the company website down, and DNS mistakes are slow to notice and slow to
propagate back.

### The Resend account and the polynize.ai sending domain

You will be sending magic links. Two things follow.

**Ask Marrs for a from-address of your own,** something like `graph@polynize.ai`, rather
than reusing `console@polynize.ai`. This is not tidiness. Sender reputation is per domain
and partly per address: if a demo blast to prospects gets marked as spam, it degrades
deliverability for **PAM Console sign-in** and the **job blueprint delivery emails** on
polynize.ai. Those are things people are waiting on. A separate address contains the damage
and is diagnosable.

**Use your own API key**, which Marrs is creating. Do not reuse the Console's. Revoking one
should never take down the other.

### The OpenRouter account

Our key already runs into a per-minute cap on Gemini under burst, and two public funnels
(`/job-mapping` and `/map-your-team`) depend on it. A demo sharing that key means a loop in
a mockup rate-limits live lead generation.

Separate key, and **ask Marrs to set a hard credit cap on it.** See the security note in
section 5, which is the real reason.

### The polynize.ai repo

You do not have it and do not need it. If you want to match a pattern from it, the two
handoff docs quote the parts that matter. Ask and I will quote more.

### The Vercel account

Shared. Your project is isolated: separate build, separate env, separate deploy history,
nothing about your deploys can reach polynize.ai. **Do not change account or team level
settings.** Project level is all yours.

### The brand

The demo shows a fictional organisation on a polynize.ai subdomain in front of prospects.
Keep it obvious to a cold visitor that the data is illustrative. One line on the page is
enough. The rest of the site is careful never to present synthetic figures as real, and
this should not be the exception.

---

## 4. Direction, in the order I would do it

**1. `noindex`, today.** Cheapest risk reduction available while the page is ungated.

**2. The gate.** Per the companion doc. Reimplement, do not integrate: there is no auth
provider, so there is nothing to plug into. It is roughly 180 lines over `jose` and Resend.
Your own `POLYNIZE_AUTH_SECRET`, never ours.

**3. Decide what the gate is for, and say so on the page.** Two different products:
an allowlist, where only invited addresses get in and anyone else silently gets nothing; or
a soft gate, where any address works and the email is the point. The Console is the first.
For a prospect-facing demo the second is usually what is wanted. Pick deliberately, because
it changes the copy and it changes what happens to an address that is not on the list.

**4. Then your integrations.** With the gate in front of them, not beside them. Section 5.

---

## 5. The security question I need answered before the OpenRouter key goes in

Marrs asked for an OpenRouter key on your project. That means server-side model calls, and
it changes the risk profile of the whole thing.

**Gating the page does nothing to protect an API route.** If the demo has a route that
proxies to OpenRouter, anyone who finds the endpoint can POST to it directly, never load
your page, never see the gate, and spend real credit until the cap stops them. Scrapers
find endpoints in bundled JS routinely.

So, before the key lands: **is the model call behind the session check, or is it a route
anyone can POST to?** If it is not gated, gate it. The session cookie is already there once
step 2 is done, so this is a few lines in the route handler, not a redesign.

The credit cap is the backstop. It is not the fix.

Two smaller ones while you are in there: never expose the key to the browser, no
`NEXT_PUBLIC_` prefix on anything secret, and rate limit per session rather than per IP.

---

## 6. Traps that have already cost us time on this stack

All four are things this codebase learned the hard way. They will transfer.

1. **`RESEND_ENABLED` must be the exact string `'true'`.** Otherwise `sendEmail` returns
   success and sends nothing. Nothing throws, nothing reaches Resend's dashboard. This cost
   me an hour of debugging a working flow.
2. **`NEXT_PUBLIC_BASE_URL` has a default of `https://pam.polynize.ai`** in the pattern you
   are copying. Leave it unset and your magic links point at the Console.
3. **The "check your inbox" state belongs in client React state.** Not a flash cookie read
   after a redirect. That version shipped here, broke, and the post mortem is in the
   companion doc.
4. **`npm run preview` before every deploy, never just `npm run dev`.** Your own deploy
   brief says this and it is correct: the dev server and the production bundle load modules
   in a different order, and you have already been bitten once by a race only the built
   version loses.

Add one of ours: **a build check that fails on an undefined CSS module class.** A missing
class typechecks fine, renders `class="undefined"`, and in an SVG paints black on black.
Ours has caught six real defects. Worth twenty lines in your repo.

---

## 7. What to ask before doing, rather than after

Short list. Everything else, just build it.

- A new DNS record, or any change to an existing one.
- A new from-address, or anything that changes what your emails look like to a spam filter.
- Raising or removing the OpenRouter credit cap.
- Anything account level on Vercel or Resend.
- Putting real client data, real names, or real numbers in the demo.

Ask Marrs for the first four. Ask me if you want to know how something works on
polynize.ai, or if you think a change of yours might reach it. I would rather answer a
question than review an incident.

---

## 8. Done looks like

- The link opens for an invited person, with no Vercel login wall, over the magic link
  flow, on `graph.polynize.ai`.
- An uninvited person gets whatever step 3 decided, and it is deliberate.
- Nothing indexable while it is a mockup.
- No route that spends money without a session behind it.
- The polynize.ai marketing site, its three funnels and the PAM Console are all completely
  unaffected, which they will be as long as section 3 holds.
