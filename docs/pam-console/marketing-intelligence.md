# The intelligence in the PAM marketing console

**Written 1 September 2026, for the marketing lead.** What the console already knows, what it will make, and where each judgement is held. This is not the user manual (that comes when the build is finished and walks you click by click). This is the management view: the model, the catalogue, the rules, and the gaps.

Every number and rule below is read out of the running code, not remembered. Where the code cites a source, the source is here too, because a figure with no provenance reads the same whether it came from LinkedIn's own documentation or an SEO blog.

---

## 1. The model, in one paragraph

One idea becomes a **Story**. The Story is committed to a **stream** (a person or the brand) and drafted as an **article**. The article is the source of truth for everything after it. Gate 3 turns the article into a **kit**: a list of typed posts, per platform, each with a job. Each type becomes a **master piece** with its own words and its own image. Gate 5 plans those pieces into a **wave** across the week, then ships them. Publishing goes through Metricool, except what is marked hand-post, which is emailed to the person to post themselves.

```
Idea → Article → Kit → Create → Ship
                  ↑              ↓
          typed post catalogue   wave → queue → Metricool (or hand-post brief)
```

### The vocabulary, because these words are used precisely

| Word | What it is |
|---|---|
| **Stream** (also lane) | Who the content is for. Polynize, Marrs, Shourov, Kristin, Julian. |
| **Story** (also narrative) | One idea walked through the five gates. The unit of work. |
| **Concept doc** | The interviewed brief behind a piece. Markdown, fixed sections, written by April. |
| **Article** | The long form drafted at Gate 2. Everything downstream derives from it. |
| **Kit** | The ticked list of post types this Story will produce. |
| **Output** | One post on one platform, with a named frame. 20 exist in the catalogue. |
| **Master piece** | The authoring unit. One body of words plus its image, serving one or more outputs. |
| **Wave** | The Story's posts laid out across the week's slots. |
| **Calendar entry** | One post on one channel at one time, with its copy and media attached. |

---

## 2. The five streams, and why the split matters

| Stream | Kind | Notes |
|---|---|---|
| Polynize | company | The brand. No avatar by choice, a mint mark instead. |
| Marrs | person | LinkedIn is hand-posted by default. |
| Shourov | person | |
| Kristin | person | Timezone America/Los_Angeles, not Sydney. |
| Julian | person | |

**Company or person is load-bearing, not decoration.** It decides which post frames a Story is offered. A first-person post with real stakes belongs to a person; the brand's version of the same job is a field report across client work, which needs nobody's sign off.

It also decides how you are allowed to read the numbers. **A personal profile takes 63% higher engagement than a company page at similar impressions** (Metricool 2026). Pooled into one ranking, Polynize would rank below every human every time and teach nothing. Person and company are never compared in the same table.

---

## 3. The five gates

| Gate | Name | What happens | Who does the work |
|---|---|---|---|
| 1 | Idea | The note, caught verbatim. Never rewritten by the pipeline. | Human |
| 2 | Article | The article is drafted the moment the Story arrives. Refine by direct edit or one instruction to April. | Agent, then human |
| 3 | Kit | Tick which posts to make. Twelve rows, defaults on. | Human, one screen |
| 4 | Create | Each master piece gets its words and its image. | Agent drafts, human approves |
| 5 | Ship | The wave is planned as drafts on the calendar, then flipped live. | Human presses it |

**Draft first is deliberate.** Gate 5 plans everything as calendar drafts before anything can go out, so the whole week is visible before a single post is committed.

**Gate progress is per piece, not per Story.** After Gate 4 you can have three pieces at Gate 5 and two still at Gate 4. The dashboard shows that as dots.

---

## 4. What one Story produces by default

Per Story, per lane, with nothing changed:

- **12 rows** on the Gate 3 screen
- **16 posts** ticked
- **7 master pieces** to write and illustrate

The seven masters for a **company** lane: shorts, carousel, images, article, texts (contrarian), texts_list (numbered rules), texts_field (field report).
For a **person** lane the last one swaps: texts_hard (hard moment) instead of the field report.

**A series counts as one decision.** The three Reels, the three TikToks and the three Shorts each render as one row with an x3 pill, because you never want hook 2 without hook 1. That is how twenty outputs fit on twelve rows.

---

## 5. The post catalogue: what we are prepared to make

Twenty outputs. Sixteen ticked by default, two blocked, one is a swap you have to reach for, and the rest are the series members behind their rows.

### LinkedIn

| Row | Frame | The job | Shown to | Default |
|---|---|---|---|---|
| Article | Pulse article | The argument at full length on a Google-indexable url, so the idea has somewhere permanent to live. | Both | On |
| Video | Vertical video | The strongest cut, captioned for LinkedIn, so the morning slot carries video. | Both | On |
| Contrarian post | Contrarian | State the belief the article argues against, then break it. This is the article's cutdown. | Both | On |
| Hard moment | Hard moment | The price paid for holding that position, in first person, with the stakes named. | **Person only** | On |
| Field report | Field report | What the pattern looks like across client work, no named client, nothing needing sign off. | **Company only** | On |
| Numbered rules | Listicle | Teach the article as numbered rules, so it carries into feeds that never saw the other two. | Both | On |
| Document carousel | Document (PDF) | The carousel narrative as a swipeable PDF. | Both | **Blocked** |
| (Explainer) | Explainer | Teach the mechanism straight, without a list and without a position. | Vocabulary only | Off screen |

### Instagram

| Row | Frame | The job | Default |
|---|---|---|---|
| Reels (x3) | Vertical video | The argument to camera, one hook per cut, same body. | On |
| Carousel | Swipe, 10 slides | The idea as ten self-contained slides, each landing on its own. | On |
| Image | 4:5 card | The idea reduced to one line a reader takes in without stopping. | On |

### TikTok

| Row | Frame | The job | Default |
|---|---|---|---|
| TikToks (x3) | Vertical video | The same cuts, captioned for TikTok, cover picked from a frame. | On |

### YouTube

| Row | Frame | The job | Default |
|---|---|---|---|
| Shorts (x3) | Vertical video | The same cuts, each with its own 100-character title and an uploaded 9:16 thumbnail. | On |
| Long form | Wide video | The argument at length, 16:9, deliberately not a Short. | **Blocked** |

### The two blocked rows, and why

- **LinkedIn document carousel.** Two independent reasons. The console has no PDF generation at all, no library and no dependency. And whether Metricool can schedule a LinkedIn document post is unverified: our client only ever sends media, never the `linkedinData.type` field their API documents. It is also a hand-post by nature rather than by setting. **Worth unblocking:** documents are the best reach multiplier on the platform at 1,198 median reach against 921 for a text post and 596 for an article, posted by only 4.88% of creators (AuthoredUp).
- **YouTube long form.** No long-form edit pipeline exists, so ticking it would be a promise Gate 4 cannot keep.

A catalogue that offers what it cannot deliver is lying, so blocked rows are visible, unticked, and say why.

---

## 6. The house rules every post obeys

These are enforced in code, not left to the writer.

1. **Every post carries an image.** No optional escape anywhere in the catalogue. Marrs: every post, even the article.
2. **No em dashes.** Instructed in the prompt and stripped on the way out. Two halves, because a model under a long prompt reaches for one eventually.
3. **Post copy is plain text, never markdown.** No asterisk bolding: the textarea renders nothing and neither does any caption box. Instructed and stripped, at the post copy boundary only. Concept docs stay markdown on purpose, and single asterisks in the slide grammar mean brand accent.
4. **The concept is the only source of truth.** No fact, name, number or story may come from anywhere else. This is why a thin concept produces a generic hook: the prompt correctly refuses to invent.
5. **We do not assert what we do not know.** Each output carries an explicit do-not-assert list, so a gap in the evidence becomes an active constraint rather than a silent omission. Example: the writer is told that the 1,300 to 2,500 character band is the overlap of two studies that disagree, not a best practice, so it cannot describe it as one.
6. **The link goes in the first comment on LinkedIn**, not the body. A link in the body costs 18.8% median reach (van der Blom). Documents put the CTA in the caption and the link in the first comment.
7. **Instagram hashtags are off by default.** Metricool 2026, 24.4M posts: posts carrying hashtags saw 31.70% fewer views and 33.89% fewer interactions than platform average. A direct reversal of common practice.
8. **The first frame is the thumbnail** on short form, so the cover is a clean hook frame rather than whatever the platform picks.

---

## 7. What we know about each platform, and how well we know it

Every figure carries a strength: **official** (the platform's own docs), **large study** (a named dataset with a stated sample), **practitioner** (loose consensus, no dataset), **ad data** (their advertising guidance borrowed for organic, weaker than it looks), **ours** (our measurement or a house rule).

### LinkedIn text

| Fact | Value | Strength |
|---|---|---|
| Hard cap | 3,000 characters | Official |
| Target band | 1,300 to 2,500 | Large study, and it is an **intersection of two studies that disagree** |
| Floor | 400 characters | Large study, the one claim all three sources agree on |
| The fold | First paragraph, or about 140 characters | **Measured against Metricool's own preview**, which beat the third-party number |

The fold is the one editorial fact the preview panel exists to show. Everything after it is read only by people who already decided to read on. Note that structure beats length here: a post written in the house style folds at its first paragraph break, often well under 140 characters.

### LinkedIn article

Cap 125,000 characters (official, and this retires the widely repeated 110,000 figure). Meta title truncates over 60. Meta description 140 to 160. **LinkedIn publishes no cover image spec for an article anywhere**, so we reuse the feed card size and say so.

### LinkedIn documents

7 to 12 pages (loose consensus only, no completion-rate data behind any of it), 50px margins, 24pt minimum type, 60 words a page. Official limits are 100MB and 300 pages. Every page must be self-contained: animation flattens to a static image and links inside the PDF are unreliable to dead in the mobile app.

### Instagram

Caption cap 2,200 (official). Fold about 125 characters (no official figure; third-party consensus that happens to match Meta's own ads guidance). **1080 x 1350 is the only size safe under both of Instagram's two contradicting ratio docs.** Carousels cap at **10 items** for us, because that is the content publishing API limit and Metricool is an API client: 11 to 20 can only be posted by hand. Every slide is cropped to the first slide's dimensions. Text on an image is not penalised; Meta retired the 20% text rule.

### Images generally

1080 x 1350 (4:5) serves both LinkedIn and Instagram from one render: it is simultaneously LinkedIn's tallest legal ratio and Instagram's recommended format. 1080 wide is the only official LinkedIn dimension. **The commonly quoted 1200 x 627 is ad guidance and must never be used for organic.**

### Video

Vertical safe area is 660 x 960 inside the 1080 x 1920 frame, insets 120 top and 288 bottom.

**There is no target-duration field anywhere in the catalogue, on purpose.** Not one of the three platforms publishes an optimal length. The figures that circulate are either watch time (8.5s on Reels, about 16s on Shorts), five-year-old ad conversion data (TikTok's 21 to 34 seconds), or directly contradictory (50 to 60s against 15 to 30s). A field would invite one of them to become an instruction.

---

## 8. The writing intelligence

**Who writes.** April, through OpenRouter. The model is an environment variable per task, so drafting can be moved without moving the others, and the console reports which model actually wrote a thing rather than making you guess from the bill.

**The four inputs.** Every piece is one function: `write(concept, brand voice, template recipe, angle, format)`.

- The **concept** is the only source of facts.
- The **recipe** governs structure: its beats, its order, its ending.
- The **brand voice** governs sound, per stream, and overrides the default register. It lives as an editable Markdown doc per stream and is read on concept synthesis, on the interview register, and on every draft.
- The **angle** governs emphasis. It selects and orders. It cannot add facts.

Output quality is bounded by the worst of the four.

**What good looks like is a fifth input, and it is his taste.** Marking a piece exemplary makes it a worked example in every later draft for the same stream and format. One real example of the house standard moves output further than another paragraph of adjectives. When analytics lands, a post that actually performed can be nominated automatically by stamping the same flag, which keeps one definition of good with two sources of evidence instead of two competing systems.

**Hook craft is a library, not a rule sheet.** Five rules (context-complete for a total stranger, concrete not abstract, exactly one open loop, a real payoff, in voice and ownable) plus a seven-pattern library with model lines, three of Marrs's real hooks, worked fixes, and a gate. This got much longer on purpose: the previous version kept every rule and threw away every example, which is exactly the wrong half to drop. Rules are compressible; examples are not.

**The concept doc carries ammunition, not just argument.** The original seven sections were all explanatory, so a thin concept plus a prompt that forbids invention produced a generic hook by design. The sections now include what the audience believes instead, and the concrete material a hook is built from.

**ICP archetypes**, per output, defaulted from the concept's "who it is for": Organisational Architect, High-Stakes Operator, Revenue Accelerator, Talent Champion, Service Ops Leader.

**Templates (recipes).** A per-stream library plus four starter templates: LinkedIn insight post, short-form video script, concept flip (split-screen short), walkthrough (screen-record long). Only templates whose format module is built are active, so the picker is honest about what one-shots today.

---

## 9. The video spine

**Shoot once, cut many.** One canonical recording owns the long form, the short-form cuts, the b-roll and the stills. Text and image outputs derive from the concept and the script, not from the recording.

The middle stages, and what actually exists:

| Stage | Role | Built |
|---|---|---|
| Script | Hybrid | Yes |
| Prezie (the touchscreen the presenter operates on camera) | Hybrid | Yes |
| Record (teleprompter) | Human | Yes |
| Rough cut | Agent | No |
| Refine | Human | No |
| Treatment | Agent | No |
| Captions | Agent | No |
| Approve | Human | No |

**This is the biggest hole in the console** and the reason YouTube long form is blocked: the console can plan, script and shoot video, and cannot yet edit it. Video that is already edited elsewhere currently has no clean door into the calendar. That is the next build.

Two adjacent things that do work: **the Studio** (what to shoot, in the order to shoot it, cross-stream, nothing else on screen) and **podcast clip proposal**, whose editorial method is Marrs's own and was validated on a real 54-minute episode before any of it was built. The principle there is worth carrying: a clip is not a contiguous slice, it is a theme condensed, and it must make full sense to someone who never heard the episode.

---

## 10. The image intelligence

**Three slide templates**, held as data so the picker, the prompt and the compositor cannot drift: Statement plate (no photo, one claim set big), Split card, Full frame.

**The hero chooser**: four images at 4:3 (2048 x 1536), click to enlarge, pick one. Regenerating gives four more.

**Three image models**, chosen per job:

| Model | Good for | Notes |
|---|---|---|
| Soul | Photoreal people | Cannot render text at all, which is why every prompt ends "no text, no words, no letters" and all brand type is composited in code. Supports Soul ID for consistent shots of the same person. |
| Nano Banana 2 (Gemini 3.1 Flash Image) | Legible text, diagrams, infographics | Slower per image than Soul, one image per request. |
| Nano Banana Pro (Gemini 3 Pro Image) | The same, first time | Twice the price. Reach for it when the text has to be right. |

All brand type is composited in code rather than generated, which is what keeps type sharp and on brand.

---

## 11. The scheduling intelligence

**The queue is ours, not Metricool's.** Their API creates a post at a concrete time. There is no append-to-queue endpoint anywhere in their 528 paths. So the queue is computed in the console: take the next free slot on that channel, schedule at that exact time.

**One table decides when everything posts.** Per stream, per platform: a timezone and a list of times. Edited on Connect Metricool, read by both the wave and the Add-to-queue button.

- **The number of times is the number of posts a day.** Two times on LinkedIn means two LinkedIn posts a day. There is no separate count field, because a count and a list can disagree.
- **The queue is per platform.** A busy LinkedIn cannot push an Instagram post into next week.
- **Slots have a preferred kind.** On LinkedIn, morning is video and afternoon is text and images, because that is the house rule. The other three platforms are untyped on purpose: nothing was said about them, and TikTok and YouTube produce three videos and no stills per Story, so typing their slots would point a preference at an empty pool.
- **Depth is reported, not capped.** If the slot the queue takes is a week or more out, it says so under the entry, in amber. The slots already are the capacity; what was missing was anyone saying how deep it had got.
- **The timezone travels with the time.** A wall-clock time without its zone is not a time, so both are stamped on the entry rather than re-derived at ship time. That is how a morning video used to go out in the afternoon.

**Auto or by hand, per stream per platform.** Marrs's personal LinkedIn is hand-posted by default: posting through a scheduler measurably restricts reach on a personal profile. A hand-post is not a notification, it is the deliverable: an email usable on a phone with one thumb, with the copy in one selectable block, the first comment separate because the link goes there, and the media as plain links to save to the camera roll.

---

## 12. What Metricool does and does not do for us

**Does:** schedule to LinkedIn, Instagram, TikTok, YouTube; take media by URL so the console never handles bytes; accept drafts (which is how the first real post was proved without risking anything public); accept first-comment text; return per-post analytics on the Advanced plan; report which platforms a brand actually has connected, which is what filters the Gate 3 screen.

**Does not:** hold a queue; render a preview (their preview is a feature of their web app, not their API, so the console's preview is ours); publish to Substack or a newsletter; verifiably schedule a LinkedIn document.

**Proven end to end.** A real LinkedIn post went out through the console with its image at the right time.

---

## 13. Analytics: what is real today

**The panel is a mock and says so**, in amber, with the reason underneath. Every field on it is one Metricool actually returns, so it is a promise about the real panel rather than decoration.

**The spike is answered.** All four questions, against the live account:

1. **Tier: available.** Every analytics endpoint returns 200 on the Advanced plan.
2. **The join works, with one extra step.** The id we store at schedule time is Metricool's own integer post id; their analytics take the platform URN. But the scheduled post carries both the provider id and the public url, and the analytics rows carry the matching url. So a second read after publication gives an exact string join, not a fuzzy match. A nightly pull has to happen anyway, so this costs nothing extra.
3. **TikTok returns JSON**, not CSV. Real per-video metrics.
4. **LinkedIn enumerates everything**, including hand-posted content. So the hand-posting decision does not blind us after all.

**Build order, once started:** our own snapshot store, then the second read after publication, then a nightly pull with backoff, then the panel swapped tile by tile showing "no data yet" rather than a zero. **A zero is a claim.**

**The load-bearing tile is the frame ladder:** each post type ranked by median reach within one voice, with the voice's own median drawn as a tick. That is the tile that answers "do my contrarian posts beat my listicles on my own audience", which is the whole learning loop. It must print n per row and fade rows under n=3, because a frame with two posts behind it is a rumour.

---

## 14. Known gaps, stated plainly

| Gap | Consequence |
|---|---|
| No video edit pipeline | Long form is blocked, and finished video edited elsewhere has no clean door into the calendar. Next build. |
| No PDF builder | The best-reach LinkedIn format is unavailable. |
| Carousels are Instagram only | The same slide narrative cannot yet serve both platforms. |
| A calendar entry has no output identity | One master serving two frames can put the wrong draft in a slot. The slot is always right; the copy can be wrong. |
| "Prepare posts" creates entries with no time | The wave then has to repair them. The queue button now covers it, but the route should not produce timeless entries. |
| No previous-set recall on hero images | Regenerate four and the previous four are gone. |
| Testing is two suites | 534 assertions on the marketing side plus the blueprint suite. Everything else is covered by a typecheck and a linter, and a typecheck cannot see a client component importing server code. |

---

## 15. Where each judgement lives

For anyone who needs to change one of these rather than read it.

| Question | File |
|---|---|
| What posts can we make | `lib/marketing/kit.ts` |
| What platforms accept, and how well we know it | `lib/marketing/kit.ts` plus `docs/pam-console/output-spec.md` |
| Who the streams are, and person or company | `lib/marketing/streams.ts` |
| When each platform posts, per stream | `lib/marketing/channel-schedule.ts` |
| How deep the queue got | `lib/marketing/queue-depth.ts` |
| Where a post folds | `lib/marketing/post-preview.ts` |
| How a hook works | `lib/marketing/hook-guidance.ts` and `docs/pam-console/april-skills/` |
| What good looks like | `lib/marketing/exemplars.ts` |
| The formats and the ICPs | `lib/marketing/output-plan.ts` |
| The recipes | `lib/marketing/template-library.ts` |
| The slide templates | `lib/marketing/slide-templates.ts` |
| The image models | `lib/marketing/higgsfield-models.ts` |
| Publishing | `lib/marketing/publish.ts`, `lib/marketing/metricool-client.ts` |
| Hand-posting | `lib/marketing/hand-post.ts` |
| Why anything is the way it is | `docs/decisions.md` (D1 to D79) |
| What is still owed | `docs/pam-console/todo.md` |

---

## 16. Three rules that outrank everything above

1. **Copy is final.** Every piece of user-facing copy in the design is exact. If it feels wrong, flag it; do not silently rewrite it.
2. **Docs change in the same commit as the code.** A drifted doc is worse than no doc, because it is believed.
3. **A settings screen wired to a store nothing reads is worse than no settings screen**, because it answers the question wrongly. That was a real bug here for weeks: posting times could be set all day and changed nothing that shipped.
