# PAM Console — Testing Checklist

**A living tracker of what to verify in the running console.** Everything below shipped to production this build cycle but has mostly been verified by build + code review, **not** by a human clicking through prod. This doc is where we track that human verification.

**How to use it**
- `[ ]` = not tested yet · `[x]` = tested + working · `[!]` = tested + broken (add a note) · `[~]` = partially working
- **P0** = blocks the value / everything downstream depends on it · **P1** = core function · **P2** = polish / edge case
- When something fails, note the symptom inline so we can act on it. Update this doc as we go, in the same spirit as the decision log.
- Test on **pam.polynize.ai** (production), signed in as a team member.

---

## P0 — critical path (test these first)

- [ ] **Box video Direct Link → Metricool ingestion.** The one true unknown. Add a Box **Direct Link** to a *video* in a stream's Media library, attach it to a piece, prepare + schedule it, and confirm the Metricool post actually carries the video (not a broken/empty attachment). Box may 302-redirect video links to `dl.boxcloud.com`; if Metricool doesn't follow it, we switch the media path to Vercel Blob. *(Images are lower-risk; test one image too.)*
- [ ] **The full spine end to end.** Concept → Create content → draft a post → approve → Prepare posts → the calendar shows one entry per channel → schedule/queue → it lands in Metricool on the right date and time.
- [ ] **State persistence across reload.** Mid-edit on a piece (text and script), reload the page: the draft, status, and attached media survive. (CLAUDE.md testing priority #1.)
- [ ] **Metricool posts at the correct local time** (not 1am). Confirms the Madrid→Sydney timezone fix still holds after all the changes.

---

## Media library (new this build — D27)

- [ ] Each stream home shows a **Media library** card with a live count ("Empty" / "N assets").
- [ ] The media page loads; **Add** a Box Direct Link with **Auto** type → it appears in the grid, image shows a thumbnail, video shows a ▶ tile.
- [ ] **Auto-detection** picks image vs video correctly from the link's file extension; the manual Image/Video override works when Auto can't tell.
- [ ] Pasting a Box **preview** link (`box.com/s/…`, not `/shared/static/…`) is rejected with the helpful "copy the Direct Link" message.
- [ ] Pasting a non-URL or a non-http(s) link is rejected cleanly (no crash).
- [ ] **Delete** removes an asset from the grid (and confirms the Box file is untouched).
- [ ] **Max file size**: Box per-file limit is **5GB** on this account — plenty for podcast video. (No console-side size gate needed since Box hosts the bytes; note it in the team manual.)
- [ ] Media added to stream A does **not** appear in stream B's library or picker.

## Piece production + media picker

- [ ] **Text piece**: the media picker shows this stream's library; selecting/deselecting assets persists (reload confirms). Attached image rides to the post.
- [ ] **Video piece (script screen)**: same picker works; the editor lock during a chat command also disables the picker.
- [ ] **Rapid multi-select** of media (several toggles quickly) all persist — this was the coalescing-race bug fixed in review; confirm nothing is silently dropped and "Saved ✓" is honest.
- [ ] Attaching media then immediately clicking **Prepare posts** carries the just-selected media onto the calendar entries.
- [ ] A piece with **no media** still drafts, prepares, and schedules as text-only (backward compatible).

## Concepts

- [ ] **Develop a concept** (April interview) → concept doc is written → lands in the stream's Core concepts.
- [ ] **Import a concept** (paste a .md) → appears; a same-title import prompts before overwriting.
- [ ] **Update concept** (April "what's changed?") → the whole doc is restructured in place, same slug.
- [ ] **Concept Library** → browse another stream's concepts and **copy** (not move) one into your stream; the source is untouched.
- [ ] **In development** shows one card per concept → the dev hub lists that concept's pieces; a concept-less piece group still gets a Create-content path.

## Content Series (templates)

- [ ] Create / edit / retire a series in a stream; the stream card reflects active count.
- [ ] "Create content" uses a series template as the default path; custom plan works as the fallback.
- [ ] The built-in starter library templates can be copied into a stream.
- [ ] A slug collision on save prompts before overwriting a refined recipe.

## Calendar & scheduling

- [ ] Calendar **List / Month / Day** views all render this owner's entries.
- [ ] **Set a time** on an entry, then **Schedule** → it posts to Metricool at that time.
- [ ] **Add to queue** → it lands in the next open ideal-time slot for that stream (per the posting schedule), not a random time.
- [ ] Links out to Metricool and back to the piece work.

## Metricool connection

- [ ] Connect Metricool lists brands (token verified) and maps stream → brand.
- [ ] Per-stream posting timezone + ideal times save and are respected.
- [ ] substack / newsletter channels are skipped (not sent to Metricool) without error.

## Brand voice

- [ ] Each stream's brand voice doc saves and is read by April on draft/interview/update.

## Cross-cutting (CLAUDE.md priorities + design principles D26)

- [ ] **Back button** goes to the previous screen from anywhere (not always the dashboard); a fresh deep link falls back to the logical parent.
- [ ] **Light / dark theme** toggle: cream light mode, mint stays legible, on-accent labels readable in both; choice persists.
- [ ] **Bordered-section hierarchy** holds on every page (each block reads as its own unit).
- [ ] **No em-dashes** anywhere in user-facing copy (including anything April generates).
- [ ] **Mobile** (iPhone-width): stream home, media library, piece screens, calendar all usable.
- [ ] Avatars render on the dashboard stream cards (the middleware static-path fix).

## Known open questions / risks

- **Box video ingestion** (see P0) — the gating unknown for video publishing.
- **AGENTS_S3_* in Vercel prod** — media metadata rides the interim Supabase store if S3 isn't configured, so the library works either way; but confirm which store it's actually using if we later expect S3.
- **Per-stream media scoping** relies on app-level filtering (no RLS) — the tests above confirm A/B isolation holds.

---

*Living doc. Add rows as features land; flip statuses as we verify.*
