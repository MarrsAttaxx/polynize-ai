# Handoff: gating graph.polynize.ai the way the PAM Console is gated

For the agent building `graph.polynize.ai` in a separate repo. Everything here is
read out of the live polynize.ai codebase, not from memory. File paths are given
so you can check any of it yourself.

Short version: **there is no auth provider to configure.** The Console's magic
link flow is about 180 lines of hand-rolled code over `jose` and Resend. You are
going to reimplement it, not integrate with it, and that is easier than it
sounds.

---

## 1. What sends the magic-link emails, and from what address

**Resend**, through the official `resend` npm package.

| | |
| --- | --- |
| Wrapper | `lib/resend-client.ts` (one `sendEmail({ to, subject, html, text })` export) |
| Package | `resend` |
| API key | `RESEND_API_KEY` |
| From address | `RESEND_FROM`, currently `console@polynize.ai` |
| Kill switch | `RESEND_ENABLED` |

### The one thing that will waste your afternoon

`sendEmail` **returns `{ status: 'skipped' }` and sends nothing** unless
`RESEND_ENABLED === 'true'` exactly, as a string. It logs a warning and resolves
successfully, so nothing throws and nothing appears in Resend's dashboard. If
your magic links never arrive, check that variable before you check anything
else.

```ts
if (process.env.RESEND_ENABLED !== 'true') {
  return { status: 'skipped', reason: 'resend_disabled' };
}
```

The `polynize.ai` sending domain is already verified in Resend, so any key on
that account can send from an address at that domain. You do not need to verify
anything new.

---

## 2. Hand-rolled or a provider?

**Hand-rolled.** No Clerk, no Auth0, no NextAuth, no Supabase Auth. Supabase is
in the stack but only as a database.

The whole thing is `lib/console-auth.ts` plus two call sites:

```
lib/console-auth.ts                     token mint/verify, allowlist, cookie helpers
app/console/_actions.ts                 sendMagicLinkAction: mint token, email link
app/console/auth/verify/route.ts        GET: verify token, set session cookie, redirect
app/console/_components/SignInForm.tsx  the form and the "check your inbox" state
```

**How it works, end to end:**

1. User submits an email to a Server Action.
2. Email checked against an allowlist held in env vars. **If it is not on the
   list the action still returns `{ ok: true }` and sends nothing.** That is
   deliberate non-disclosure, so the UI can never be used to enumerate who has
   access.
   Copy this behaviour.
3. Allowed email gets a **JWT, HS256, signed with `POLYNIZE_AUTH_SECRET`**, with
   `{ email, type: 'magic-link' }` and a **15 minute** expiry.
4. The link is `${NEXT_PUBLIC_BASE_URL}/console/auth/verify?token=<jwt>`.
5. The verify route re-checks the token, **re-resolves the allowlist at click
   time** (so removing someone between send and click denies them), mints a
   second JWT with `type: 'session'` and a **30 day** expiry, and sets it as a
   cookie.
6. Cookie: name `polynize_console_auth`, `httpOnly`, `sameSite: 'lax'`,
   `secure` in production, `path: '/'`, `maxAge` 30 days.

`jose` is the only dependency. Two token types distinguished by a `type` claim,
checked on verify, so a magic-link token cannot be replayed as a session.

**Allowlist env vars, for reference:**

| Var | Format | Meaning |
| --- | --- | --- |
| `CONSOLE_ALLOWED_EMAILS` | `a@x.com,b@y.com` | Full access |
| `CONSOLE_CLIENT_EMAILS` | `a@x.com:acme,b@y.com:globex` | Scoped to one client slug |

You almost certainly want one flat list. The two-tier scope model exists because
the Console shows different clients different data.

---

## 3. Redirect / callback URLs

**Nothing to add, and nobody has to configure anything for you.** That question
assumes a provider with an allowed-callback list. There is no provider, so there
is no list. The callback is just a route in the app that owns the cookie.

Two things follow, and both matter:

### Use your own secret, not ours

`POLYNIZE_AUTH_SECRET` is what signs the tokens. **Generate a separate one for
the graph project.** If both projects share a secret, either one can mint a
token the other will accept, so a bug in a mockup becomes a way into the
Console. Different secret, no shared blast radius.

```bash
openssl rand -base64 48
```

### You get a separate session for free, and that is correct

The Console cookie is set with no `domain` attribute, which makes it **host-only**:
a cookie set on `pam.polynize.ai` is never sent to `graph.polynize.ai`. So there
is no accidental single sign-on between the two, and no way for the graph project
to read a Console session. Signing in to one does not sign you in to the other.

Do not "fix" this by setting `domain: '.polynize.ai'`. That would put a Console
session cookie on every subdomain of polynize.ai, readable by anything running
there, for a mockup.

### Env vars to set on your Vercel project

| Var | Value |
| --- | --- |
| `POLYNIZE_AUTH_SECRET` | a fresh random string, yours alone |
| `RESEND_API_KEY` | see section 4 |
| `RESEND_FROM` | `console@polynize.ai`, or ask Marrs for a distinct address |
| `RESEND_ENABLED` | `true`, and read the warning in section 1 |
| `NEXT_PUBLIC_BASE_URL` | `https://graph.polynize.ai` |
| your allowlist var | comma-separated emails |

`NEXT_PUBLIC_BASE_URL` is the one that breaks silently. The Console defaults it
to `https://pam.polynize.ai` when unset, so an unset value on your project mails
out links pointing at the Console.

---

## 4. The API key

**I am not passing you a key, and you should not want me to.** Keys pasted into
chat end up in transcripts and logs.

The right move, in order of preference:

1. **Marrs creates a second Resend API key** scoped to this project, at
   resend.com → API Keys, and adds it to your Vercel project's env himself.
   A separate key can be revoked without taking down the Console's sign-in or
   the two funnel emails on polynize.ai.
2. **Copying the existing key across** also works and is worse: one revocation
   then breaks both projects.

Either way it is Marrs adding it in the Vercel dashboard for your project, not
me handing it over. Ask him for a key and he can create one in about a minute.

---

## 5. Style guide for the gate

Match the Console's gate rather than the marketing site: it is the same kind of
surface, a single card on an empty page. Source of truth is
`app/console/_components/sign-in-gate.module.css` and `app/tactile.css`.

### Tokens

```css
/* Dark, the default */
--bg: #0a0a0f;
--surface: #13131a;
--text: #f4ece4;      /* headings, primary */
--text-2: #c7b9ac;    /* body */
--text-3: #8a7d72;    /* meta, eyebrows */
--mint: #69fccb;      /* the accent. CTA fills, accents, focus rings */
--coral: #ff7a6b;     /* errors, and "human" in the lane model */
--amber: #f0b86b;     /* warnings, and "hybrid" */
--border: rgba(105, 252, 203, 0.18);
--border-soft: rgba(244, 236, 228, 0.08);
```

**Mint is `#69fccb` and only `#69fccb`.** A second green was in circulation until
recently and it has been removed everywhere. Do not introduce another one.

The one legitimate exception: in light mode mint becomes `#0f7d61`, because
`#69fccb` on a cream background is about 1.3:1 contrast, invisible. If you build
a light mode, darken the accent and do not just swap the background.

### Type

Three faces, all via `next/font/google`:

| Face | Used for |
| --- | --- |
| **Space Grotesk** | headings. 600–700 weight, `letter-spacing: -0.03em` |
| **Inter** | body and buttons |
| **JetBrains Mono** | eyebrows, meta, timestamps, anything technical |

Headline: `font-size: clamp(30px, 4.5vw, 44px); font-weight: 700; line-height: 1.05`.

### The gate, concretely

- Full-height flex centre, `padding: 64px 20px`.
- One card, `max-width: 480px`, `padding: 36px`, `border-radius: 18px`.
- Card is a raised surface: `background: var(--tac-surface)` with
  `box-shadow: var(--tac-shadow-raised)`. **Depth comes from shadows, never
  from borders or blur.** That is the house rule that makes the surface read as
  tactile.
- Inputs are the opposite: **recessed**, `background: var(--tac-inset)`,
  `border: 0`, `box-shadow: var(--tac-shadow-inset)`, `border-radius: 10px`.
  Focus adds `0 0 0 2px rgba(105, 252, 203, 0.5)` on top of the inset shadow.
  Invalid adds a coral ring instead.
- Primary button: solid `var(--mint)` fill, dark ink on top (`var(--bg)`),
  `border-radius: 10px`, `padding: 13px 18px`, weight 600. Hover lifts
  `translateY(-1px)` and adds a mint glow. An arrow inside nudges `translateX(2px)`.
- Eyebrow above the heading: mono, 11px, `letter-spacing: 0.2em`, uppercase,
  `--text-3`. The Console's reads `§ polynize agentic management console`.
- The full stop after a heading is mint: `Check your inbox<span class="accent">.</span>`.
  Small, and it is a recognisable part of the look.

### Copy rules, which are not optional

These are enforced across the site and someone will notice:

1. **No em dashes.** Anywhere, ever. Comma, full stop or colon.
2. **Australian spelling.** organise, prioritise, behaviour, centre.
3. **No** "unlock", "supercharge", "revolutionise", "game-changing", or
   "leverage" as a verb.
4. Sentence case in body copy. Plain declaratives. No exclamation marks.
5. Never invent a metric. If you need a number on the page, ask.

### The confirmation state

Worth copying wholesale, because it was hard to get right. After submit, show
"Check your inbox", echo the submitted address in mint, and state the expiry
("The link will expire in 15 minutes").

**Hold that state in client React state, set synchronously on submit.** Do not
implement it as a server-rendered view gated on a flash cookie after a redirect.
That was the original approach and it broke: the post-action render read the
pre-submit cookie, re-rendered the form, and the confirmation only appeared
after a hard refresh. The comment at the top of `SignInForm.tsx` documents the
whole failure. Client state, no navigation, no cookie, no cache dependency.

---

## Anything else

Ask Marrs. The only things you need from the polynize.ai side are a Resend API
key and the DNS record, and both are his to hand over.
