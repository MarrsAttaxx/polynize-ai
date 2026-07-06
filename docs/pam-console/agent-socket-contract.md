# PAM Console — Agent Socket Contract (T5)

**The interface between the console (conductor) and the agents (plugs).**
**Version 0.1 · July 2026 · Owner: Marrs · Author: CC · Status: draft, dependency-free groundwork**

> This is the concrete expansion of decisions D1 (no central agent) and D3 (the socket is a narrow async job contract) in `storage-and-agent-socket.md`, plus the PM note that moves April's concept interview **in-console** (SOC 2: minimise Slack data flow). It defines the plug shape so April can be built against a spec, and so the console can build the intake + script surfaces now, backed by the interim OpenRouter stand-in, and swap the real agents in behind the same interface with no screen rework.
>
> **Nothing here assumes a live April.** The console side is buildable today; the real agents swap in behind it.

---

## 1. Two capabilities, one seam

Per D3, agent interaction splits into exactly two shapes. The console exposes both behind a single transport-abstract provider seam (`lib/agents/`, mirroring the one-file-swap pattern of `lib/llm/`):

| Capability | Shape | Latency | Used by |
|---|---|---|---|
| **converse** | synchronous request → response | seconds | the intake interview (April), the Script-screen context chat (script-editor). Interface-driving. |
| **jobs** | async `submit → job_id → status → output_ref` | seconds to ~15 min | productions: `concept_finalize`, `script_draft`, later `rough_cut`, `broll_generate`. |

The console never knows *who* is behind the seam. Interim = the console's own OpenRouter layer (D1 interim runtime). Real = April / Mikey via their socket. Swapping is a config change, not a screen change.

```ts
// lib/agents/ — the seam (illustrative)
interface AgentProvider {
  // Interface-driving. One turn in, one turn out. No persistence here.
  converse(req: {
    agent: 'april' | 'script_editor' | ...;
    owner: string;
    system_context: { brand_voice?: string; concept?: string; format?: string };
    history: { role: 'user' | 'assistant'; content: string }[];
    message: string;
  }): Promise<{ reply: string; signal?: 'ready_to_finalize' }>;

  // Productions. Enqueue and poll.
  submitJob(job: { job_type: JobType; owner: string; input: JobInput }): Promise<{ job_id: string }>;
  jobStatus(job_id: string): Promise<{ status: JobStatus; output_ref?: string; error?: string }>;
}
```

The interim provider satisfies `submitJob`/`jobStatus` by doing the work inline and returning a job that is already `done` on first poll — the console code is identical whether the worker is instant (OpenRouter) or slow (Hermes April). Same plug.

---

## 2. Job lifecycle

The `jobs` table (schema in `storage-and-agent-socket.md` D2; **Phase-1 interim**: stored in the existing `content_shoot_sheets` key space under `jobs/{owner}/{job_id}`, listed by prefix, exactly like the interim piece store — swaps to the real table when `0009` lands, no caller change).

```
queued   -> console wrote the row and dispatched
running  -> worker claimed it
done     -> worker wrote output_ref, set done
failed   -> worker set a human-readable error, set failed
```

- The **console** writes the `jobs` row, dispatches, and **polls** `jobStatus` (or the table). It surfaces completion on the piece + the in-development list, so a refresh or navigate-away always shows truth.
- The **worker** reads `input`, does the work, writes `output` (a bucket object or a DB field), sets `output_ref` + `done` — or `error` + `failed`. **Never leave a job running.**
- **Idempotency:** a worker handed a `job_id` it already completed must not double-write; check status first.

### Worker wiring — the one open decision for April's builders

The console can drive either shape; pick one and the console builds the matching dispatcher:

- **(a) Pull** — the worker polls the `jobs` store for `agent=<name>, status=queued`, claims one, writes output. Best for a Lightsail worker; no inbound URL. **Recommended.**
- **(b) Push** — the worker exposes `submit`/`status` HTTP endpoints the console calls.

---

## 3. Job types (Phase-1 relevant)

### `concept_finalize` — produces the concept doc (the intake screen's output)
The interview turns run through **converse** (sync). When the owner (or April via `signal: 'ready_to_finalize'`) ends the interview, the console enqueues this job.

```
input:  { owner, stream, framing, transcript: Message[], brand_voice_ref }
output: writes  pam/concept-bank/{owner}/core-concept-{framing-slug}.md   (the concept doc)
        output_ref = that bucket key
        console also writes an INDEX row so the doc is listable (see §5)
```

### `script_draft` — the original T5 draft (feeds the Script screen)
```
input:  { owner, stream, format, pillar, concept_ref }
output: the short-form script text (HOOK / BEAT / CTA + emphasis closer), written to
        the piece's script field (content_shoot_sheets interim -> content_pieces.stage_state later)
```

Both obey the voice rules (no em-dashes, no emoji, no hashtags unless asked — enforced in the agent's prompt and stripped as a console backstop).

---

## 4. The intake interview (top of the spine)

The intake screen is the surface **before** the Script screen — where concepts are *created*, not assumed. Flow:

1. Owner starts a new concept on the intake screen.
2. The console hosts the interview in its own **context-chat** (the same primitive shipped on the Script screen in T4). Each turn calls `converse({ agent: 'april', owner, system_context: { brand_voice }, history, message })`. April asks one or two questions at a time, drawing the concept out.
3. When the interview is complete, the console enqueues `concept_finalize`.
4. The resulting `core-concept-{framing}.md` is written to the bucket + indexed, and becomes the input the Script screen (and the rest of the spine) consumes.

**Transport-abstract (PM design note):** the console **always** hosts the interview via its own chat, calling April through the seam. If Slack is enabled later as an *additional* surface, that is April's concern, not a console rebuild. Do not build anything that assumes console-only forever, and do not build anything that assumes Slack.

---

## 5. The concept doc artifact

- **Filename:** `core-concept-{framing-slug}.md` (e.g. `core-concept-strip-the-ai-out-first.md`).
- **Location:** `pam/concept-bank/{owner}/` in the `polynize-agents` bucket (ap-southeast-2, private). **Phase-1 interim** (until bucket creds land): the body sits in the interim store, same swap pattern as everything else.
- **Index:** a listable row (interim: Supabase; later: `concepts` table with `bucket_key`) so the console can show the owner's concept bank. `{owner}` keying matches the console identity (see open decision — email vs slug).
- **Body:** enough for the downstream stages to consume — the framing, the core thesis, the audience, the key beats/arguments, and the source voice. The Script stage reads this to draft; the format-variations stage reads it to fan out.

---

## 6. Owner threading

Every converse call and job input carries `owner`. April reads *that owner's* brand-voice doc (`pam/brand-voice-docs/{owner}/...`) and writes to *that owner's* concept-bank prefix. Bucket prefixes are owner-partitioned. This is continuity, not permissions (D4) — team users can still read across owners in v1.

---

## 7. What's buildable now vs gated

| Piece | Status | Gated on |
|---|---|---|
| The seam (`lib/agents/` provider interface + interim OpenRouter provider) | ✅ shipped | — |
| The interim `jobs` store + polling | ✅ shipped | — |
| The intake screen + interview chat + concept view + Concept bank (interim April stand-in) | ✅ shipped | — |
| Concept-doc **write to the bucket** | interim store now (keyed on the eventual S3 key) | bucket creds (`AGENTS_S3_*`); owner-key = email (confirmed) |
| The **real** April behind the seam (pull worker) | — | April provisioned (Master Agent Builder) |

---

## 8. Open decisions

1. **Pull vs push** worker wiring (§2) — April's builders choose; console builds the matching dispatcher.
2. **Owner key** = signed-in email (recommended, matches the interim store) vs a short slug. Locks the bucket prefix + index key.
3. **Bucket credentials** (`AGENTS_S3_ACCESS_KEY_ID` / `..._SECRET`) into Vercel + April's runtime — provisioned bucket, keys pending.
4. Per-agent OpenRouter keys + the settled DeepSeek model id.

---

*Draft for review. Once confirmed, this becomes the contract T5 is built against, and the interim OpenRouter provider is the stand-in until the real agents plug in.*
