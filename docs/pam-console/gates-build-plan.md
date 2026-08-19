# The Gates: build plan

**v0.1 · 18 August 2026 · Follows the approved mockup (claude.ai/code/artifact/c7b03994). Build starts when the five decisions at the bottom are answered.**

The rule for the whole build: **reuse before new**. Most gates are existing parts rearranged. The genuinely new code is small and named below.

---

## 0. The cadence layer (your new requirement, first because everything queues into it)

**Target:** 2 posts per channel per day. Morning and early afternoon. Ultimate state, not week one.

**How it works here:** Metricool's API has no queue. Ours is computed console-side and already exists (`posting-schedule.ts`): a timezone plus daily time slots, and "Add to queue" appends to the next open slot, then schedules at that concrete time. Same outcome as a Metricool queue, one honest wrinkle: the slots live in our config, not in their UI.

**What changes:**

| Now | Becomes |
|---|---|
| Slots per stream | Slots per **channel** (platform x stream), two a day |
| Add to queue is a button | An **approved piece auto-queues** to its channel's next open slot |

**The honest maths, corrected 19 August 2026 (D42).** The line below was arithmetically right and operationally false, so it is kept with its correction rather than quietly rewritten.

~~2/day across LinkedIn, Instagram, TikTok, YouTube = 56 slots a week. One story kit ≈ 19 pieces. So ultimate state is roughly **3 stories a week in flight**.~~

**Slots are not fungible across networks.** A LinkedIn post cannot fill an idle TikTok slot, so dividing aggregate capacity by a kit total is not a valid move. The honest figure is the **per-network floor**: on the v1 kit that was **2 stories a week**, set by Instagram at exactly 14 posts into 14 slots. On the typed kit (15 posts: LinkedIn 4, Instagram 5, TikTok 3, YouTube 3) it is 2.8, and **1 a week** if LinkedIn respects the only cadence evidence there is.

That evidence, from output spec section 4: **4 to 5 LinkedIn posts a week** measures 2.60% ER and 28% more impressions per post, and only 4.45% of profiles manage it. Nothing measures above 5. The 2-a-day target is 14, which is not a stretch goal, it is off the end of the data. **Recommendation, pending Marrs: LinkedIn drops to 1 slot a day on weekdays.** Everything else keeps 2 a day, which is a shape decision from his own words rather than an evidenced one, and should not be described as evidenced.

Two things nothing currently guards. Capacity is not enforced: `nextOpenSlots` walks 60 days forward and always finds something, so an oversubscribed channel silently slides posts into future weeks and compounds. And past that 60-day walk an entry is created with no `scheduled_at`, which the ship path filters out, so a sustained overrun manufactures posts that can never ship and reports no error.

The ramp: at 1 story a week the typed kit gives LinkedIn 4 of 7 days and Instagram 5 of 7, while TikTok and YouTube get 3 of 7. We fill the second daily slot by adding stories, never by padding kits.

**Posting times research:** two sources, in order. (1) Metricool exposes a best-time-to-publish endpoint per channel: I pull it during the Step 0 spike and propose a times table for you to approve. (2) The Learn loop later refines those times from our own numbers. No guessing.

---

## 1. The spine (data)

Evolve, don't greenfield. Existing stores keep their data.

| Concept | Today | Becomes |
|---|---|---|
| Story | `concept-store` doc | + `lane` (marrs / polynize), + `article` (the long form), + `gate` (1 to 5 / shipped), + `idea_ref` |
| Piece | `piece-store` (exists, close) | + `story_ref`, + `channel` (one platform each), + `master_ref` (which asset it carries), + `queued_slot`, + `metricool_id` |
| Kit | new, small | The per-lane default tick list per platform. Confirming Gate 3 creates the Pieces |

---

## 2. Gate by gate: reuse vs new

| Gate | Reused (exists today) | New |
|---|---|---|
| **1 · Idea** | Ideas inbox + store | Lane picker, "Develop" creates the Story |
| **2 · Article** | April chat (ChatPanel: whole-doc rewrites, one-click undo), brand voice, em-dash guard | Article draft call (idea → article, one shot), the two-pane screen |
| **3 · Kit** | Metricool channel mapping per stream | The platform-grouped tick screen; Pieces created on confirm |
| **4 · Create** | Staged build (hooks/arc/script), text drafting, per-platform captions, media library, studio queue, teleprompter | One-card-at-a-time flow; carousel = prezie frame export; quote images = text-on-image card; cards derive from Gate 3 ticks |
| **5 · Ship** | Calendar, Metricool client, posting schedule, next-open-slot append | The week wave screen; per-channel 2/day slots; the auto-queue default |
| **Learn** | nothing | Metricool analytics pull, weekly; rolls up per story; winners flag as exemplars (exemplar store exists) |

The only two genuinely new *capabilities* (everything else is screens over existing parts):
1. **Prezie frame export** (Gate 4 carousel and quote images need stills out of the prezie).
2. **Analytics pull** (Learn).

---

## 3. Build order

**Step 0 · The Metricool spike (hours, not days).** Answers questions the build depends on, before any code:
- Can it push LinkedIn PDF carousels? True LinkedIn Articles, or long text posts only?
- Pull the best-time-to-publish data per channel → propose the 2/day times table.
- Confirm channel timezones are set to Sydney.

**Week 1 · Spine + Ship + the pilot.** Story/lane/gate fields on the stores. Per-channel slots. The wave screen. Then the pilot: 3 Types pieces assembled by hand where gates don't exist yet, and the Metricool button pressed for real (the D18 gate, still never fired). *The week ends with published content.*

**Week 2 · Kit + Create.** The tick screen creates Pieces. The one-card flow with script (staged build), texts, captions cards live; carousel and images cards accept manual media as the fallback.

**Week 3 · Article + Idea + the board.** April's two-pane article screen. Lane picker on the inbox. The board (every story at its gate) becomes the marketing home.

**Week 4 · The two new capabilities.** Prezie frame export feeding carousel and quote-image cards. Mobile pass over every gate.

**Then: the hold.** Four stories through the gates, one a week, nothing new built. The Learn loop is built *during* the hold (it needs published data to pull anyway).

Parked modules (podcast, three streams, freeform prezie authoring, template picker) get hidden in week 3 with the board. Data kept.

---

## 4. UI/UX rules carried from the mockup

- One gate, one screen, one mint decision bar. You advance by deciding.
- Back goes back. No jumping forward.
- Gate 4 shows one card at a time, ordered: scripts, carousel, images, texts, captions. Video first because it is the long pole.
- Nothing explains what you already know. Labels, not lectures.
- Every screen works at 375px. Verified per gate before it ships, not after.

---

## 5. The five decisions (build starts on your answers)

1. **The interview dies.** Idea → April drafts the article directly → you edit with her in chat. No more Q&A interview step. Yes?
2. **Auto-queue as the default.** An approved piece drops into its channel's next open slot as a draft; Gate 5's button flips the whole wave from draft to publish. (This is your "finish a piece, it adds to the queue" plus one safety catch.) Yes, or straight to live with no draft step?
3. **Channels for the first target:** Marrs LinkedIn, Instagram, TikTok, YouTube. Polynize page joins after the hold. Yes?
4. **The board replaces the marketing home.** Streams page goes; every story at its gate is the home. Yes?
5. **Old concepts migrate only when picked up**, never in bulk. Yes?

Answer with five words if you like: "1 yes 2 draft-first 3 yes 4 yes 5 yes".
