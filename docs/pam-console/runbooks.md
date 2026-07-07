# PAM Console — Runbooks

**Operating the live pieces without reading the code.** Pair with `agent-socket-contract.md` (the contract) and `decisions.md` (D16/D17). Last updated 2026-07-07.

---

## The agent bridge (real April)

### What it is
The console is the conductor; April is a pull worker on the Lightsail box (`april-bridge.service`). The interview runs console-side in April's name; `concept_finalize` is a job April claims and completes. Live since 2026-07-07 (`AGENT_PROVIDER=hermes`).

### Activate / roll back (the flip)
- **Activate:** set `AGENT_PROVIDER=hermes` in Vercel, redeploy. (Bucket keys + `PAM_AGENT_TOKEN_APRIL` + `APRIL_OPENROUTER_API_KEY` must already be set.)
- **Roll back to the interim stand-in:** unset `AGENT_PROVIDER` (or set anything ≠ `hermes`), redeploy. The interim OpenRouter provider takes over immediately; the pull API goes inert (503). Safe at any time — no data migration, concept docs already written stay in the bucket.
- Env changes take effect only on the **next deployment** — always redeploy after changing them.

### Read the state from outside (no dashboard needed)
`POST https://pam.polynize.ai/api/agents/jobs/claim` with no/!valid token:
- **503** `agent bridge inactive` → dormant (`AGENT_PROVIDER` ≠ hermes). Interim flow is serving.
- **401** → bridge active, token required. This is the go-live signal (503 → 401 on flip).
- A valid-token claim (April) returns **200 `{job:…}`** or **200 `{job:null}`** (idle).

### Env map
| Var | Where | Purpose |
|---|---|---|
| `AGENT_PROVIDER=hermes` | Vercel | the activation switch |
| `AGENTS_BUCKET` / `AGENTS_BUCKET_REGION` / `AGENTS_S3_ACCESS_KEY_ID` / `AGENTS_S3_SECRET_ACCESS_KEY` | Vercel | console reads/writes the bucket (concepts to S3) |
| `PAM_AGENT_TOKEN_APRIL` | Vercel | verifies April's bearer |
| `APRIL_OPENROUTER_API_KEY` | Vercel | bills the console-run interview to April |
| `PAM_AGENT_TOKEN` (= `PAM_AGENT_TOKEN_APRIL`), `CONSOLE_BASE_URL` | April's box | her poll loop |

### Operating rules (watch-items)
- **Exactly one poller per agent.** The interim claim is not atomic; a second April poller could double-claim.
- **10-min lease:** a job left `running` >10 min is treated as abandoned and re-claimable (crash recovery). April should complete in seconds and POST `{error}` fast on failure rather than lean on the lease.
- **Drain on success:** after `/complete`, claim again immediately; sleep only on `{job:null}`. Poll interval ~3s (≥2s; each claim scans the interim jobs store).

### Triage (first place to look)
| Symptom | Likely cause | Where |
|---|---|---|
| Job never claimed (stuck `queued`) | redeploy not live (April still 503) OR token mismatch (April 401) | April `journalctl -u april-bridge -f`; the 503→401 signal above |
| Claimed, stuck `running` | synthesis or `/complete` failed | April logs: `/complete` status. `500`=S3 write (check `AGENTS_S3_*`/bucket perms), `422`=missing framing, `403`=agent≠job |
| Job `failed` | April POSTed `{error}` (synth/validation) | April logs |
| `done` but concept 404 | slug surprise | compare `output_ref` to the URL |
| Interview turn 502 | LLM/bucket blip | console logs `[intake.interview]`; brand-voice read degrades gracefully, so usually the LLM call itself |

---

## Storage backends (what lives where)
- **Concept docs:** S3 bucket `pam/concept-bank/{owner}/core-concept-{slug}.md` when `AGENTS_S3_*` is set (markdown + frontmatter); else the interim `content_shoot_sheets` table under the same key.
- **Pieces:** interim `content_shoot_sheets` keyed `marketing/{owner}/{pieceId}` (migration `0009` / `content_pieces` not yet applied).
- **Jobs:** interim `content_shoot_sheets` keyed `jobs/{owner}/{jobId}` (0009 `jobs` table not yet applied). Owner key = signed-in email throughout.

---

## Add a new user / stream (owner card)
A "stream" is an owner bucket (brand or person) shown as a dashboard card.
1. Add an entry to `lib/marketing/streams.ts` (`STREAMS`, in display order). That is the single source — the dashboard card, the per-stream view, the intake selector, and the finalize validator all read it. Nothing else to change for a card.
2. Their concept docs auto-partition under `pam/concept-bank/{their-email}/` on first write; no bucket setup needed.
3. Only if that person gets **their own agent** later: add a `PAM_AGENT_TOKEN_<NAME>` entry to `AGENT_TOKEN_ENV` in `lib/agent-auth.ts` and a `JOB_AGENT` route in `lib/agents/jobs-store.ts`. A stream/user alone needs neither.

---

## Deploy discipline
Push to `main` → Vercel auto-deploys. Verify with `gh api repos/polynize-agentic/polynize-ai/commits/<sha>/status --jq '.state'` → `success`. There is no staging; when a change touches schema-shaped data, deploy the console before the data (D9).
