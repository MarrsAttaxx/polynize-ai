# PAM Console: the to-do list

**The running list of what is asked for and not yet built.** Kept here rather than in chat because a request made in one session and acted on three sessions later needs somewhere durable to live. Newest asks at the top of each section.

Anything already built is in `decisions.md`, not here. This file is only what is still owed.

## The order, set by Marrs 25 August 2026

**Build order:** hero image (**done**, D51) → narrative image pool (**done**, D52) → template picker (**done**, D55). All three landed. Next up is the priority 1 gap: the hero offered as the image on a text post, and item 1, no file upload.

**Flow priority, which is a different axis and outranks the build order when they disagree:**

| Priority | Flow |
|---|---|
| **1** | **Text + image.** The one to get right. |
| 2 | Video |
| 3 | PDF |
| low | LinkedIn carousel |

That reordering matters more than it looks. It means the carousel work in progress is serving priority 3 and low, while **the image on a text post is priority 1** and today has no generation path at all: `TextOutputScreen` offers only the media picker. So the hero and the narrative pool are not carousel features, they are the text-plus-image flow, and the template picker is the one item that is genuinely carousel-first.

---

## Blocking a full walkthrough

**1b. Generated images in the media library were saved as vendor urls, so they would have 404'd. FIXED (D60).**

`/media/add` stores a url and nothing else, by design (D2, amended 2026-07-14): a media asset is a reference to a file hosted somewhere else. That is right for a Box link and wrong for a Higgsfield generation, whose url is temporary.

**The fix went in `/media/generate`, not in `/add`.** Auditing the four routes that hand a url to the library showed exactly one hole: `/edit` already returned `hostGeneratedImage`'s url and `/overlay` already returned `renderAndHostOverlay`'s, both ours, and `/generate` was the only one still handing back a raw vendor url. So `/add` keeps its contract untouched and needs no flag from a client that might forget to send one, and all three generation routes now agree.

**Anything registered before D60 is still a temporary url.** Nothing scans for or repairs them: a library entry that has stopped loading has to be regenerated. Worth knowing before someone hunts for a bug in the picker.

**1. No file upload.** A media asset is a URL reference only, so a recorded video has to go to Box by hand, its Direct Link copied, and pasted into the stream media library on a different screen before it can be attached to a piece. Nothing on the Script screen, the studio row, or the Recorded button says any of this. This is the last hard gap between Gate 4 and a published post.

**2. Metricool has never actually been fired.** The D18 gate: the publish button has never been pressed against a real brand. Everything downstream of Gate 5 is unproven.

---

## Carousels (in progress, 25 August 2026)

**3. Three stylistic templates. DONE (D55).**

What exists and is proven (`npm run proof:slides` writes one PNG per template at 1080 x 1350):

| Template | What it is | Generations for a 10 slide set |
|---|---|---|
| **Statement plate** | No photo. One claim set big on the brand field, ghosted slide number, accent rule, footer. | **0** |
| **Split card** | A photo in a window up top with the accent seam under it, words beneath. Half the slides carry one. | **5** |
| **Full frame** | One generated image edge to edge, words over it. The old behaviour. | **10** |

`generationsFor()` exists so the picker can tell him the cost before he picks, which is the answer to "a full carousel is a coffee break".

**The picker landed (D55).** Three options on the start panel, each drawing a 4:5 schematic of its own layout so the choice is visual, each saying what it costs. Split card is the default for a new set. Changing the look after the fact sits folded on the run screen: free in every direction except out of a statement plate, which has no picture briefs for a photo look to draw and so says *April writes the set again* before it asks.

**What the picker also fixed, and it was bigger than the missing field.** The render call was sending the slide's own fields and none of the plan's: no `template`, no `accent`, no `kicker`, no `total`. `total` defaulted to 1, so every slide ever rendered came out with no `03 / 10` index and no standing label. The footer the compositor draws had never appeared in production.

Two controls went with it, both of which had stopped meaning anything: the **Size** select (the fitter sizes type to the words it was given and cannot honour a fixed size and still fit) and **where the words sit** on any look but the full frame (the other two ARE the typesetting, and the compositor ignores `position` on both).

Original ask, kept for the reasoning. Marrs: *"we have to have three templates to choose from. Each needs to be on-brand graphically, with minimal text and a small image. One of them can be sort of full-image generation, maybe... Someone can select the template, write a bit about what they want, and then it generates the images."*

Constraint that decides the shape: **the only live image model is Soul, photoreal people.** It cannot make a diagram, a chart, an abstract mark or legible type. So at most one template can lean on generation; the other two must render from brand type and colour with at most one small photo. `next/og` is already a proven dependency (`lib/marketing/text-overlay.tsx`), so deterministic composition is the path.

The template is a property of the PLAN, not of each slide: picked once for the set.

Secondary benefit worth keeping in view: templates that need no image prompt per slide **shrink what April has to write**, which is the payload that has been making the 10-slide call fragile.

**3b. A HERO IMAGE that sets the style for the rest. DONE (D51), rebuilt as a four-up chooser (D56).** Marrs: *"we need a 'Hero Image' as an option, so a main hero image gets created that can then set the style for the rest of the images."*

"The look" panel now sits at the top of Gate 4, above the cards, because it is upstream of every image below it. Write a line, make it, and blessing it registers it in the library and pins it on the narrative. Every image generated afterwards is generated against it. Optional: a narrative with no hero behaves exactly as before.

**D56 rebuilt the panel** on his three complaints: one candidate became **four at 4:3**, the 64 by 80 thumbnail became a two-across grid at ~290px, and clicking a picture opens it full size, which is where the choice is made. 4:3 turned out to be a real Soul size (`2048x1536`) sitting unused in the SDK's 13 entry enum, so it needs no crop. The hero is therefore **landscape now and no longer pre-cropped to the 1080 x 1350 post frame**, which suits the LinkedIn text-plus-image flow and costs the ready made Instagram crop that nothing was using yet.

Still owed on the hero, small: it is not yet offered as the image on a **text** post, which is priority 1. It has a real library id so it is already attachable by hand; what is missing is the text screen offering it by default, which is the same build as 3c.

Original reasoning, kept:

**Half the plumbing existed.** The render route already takes a `referenceUrl` and passes it to Soul as `image_reference`, and `ImageScreen` already sends the first approved slide's background as that reference, so later slides are generated against the first one. What is missing is making it a deliberate STEP rather than a side effect of whichever slide happened to be approved first:

- Generate the hero on its own, before the set, and bless it explicitly.
- Pin it as the reference for every subsequent generation rather than inferring it from approval order.
- Let it also be slide 1's background, since that is usually what it is.

This belongs with the template picker (item 3), because "pick a template, then make the hero, then make the rest" is one flow and the hero is what makes a template's look concrete before ten generations are spent.

**3c. The image picker on a text post shows THIS narrative's images first. DONE (D52).**

Old ask below. Also worth recording, from the same conversation:

**THE HERO IS USUALLY A SCENE, NOT A FACE.** Marrs: *"the hero image is not always going to be someone's face. It could just be a Higgsfield-generated image. For the AI emergent article... they want to generate a hero image, which may be 1882, New York... For a particular narrative, it's less likely people are going to use the Soul image reference."*

The hero route already works this way: it sends a prompt only, with **no Soul ID and no reference image**, so it is scene generation from the first line. The panel copy asks for "a scene, the light, the mood" rather than a person. Nothing to change, and it is worth knowing that it was right by accident rather than by design, so nobody "fixes" it into a portrait tool later.

What this DOES sharpen is item 5. Soul is a photoreal-**people** model being asked for 1882 New York, which it will do passably and not well. A second model (Nano Banana Pro or GPT Image 2) matters more for the hero than for anything else in the kit, because the hero is the one image the whole narrative inherits from.

Original ask, kept for the reasoning: Marrs: *"on the text options within a narrative stream, the image selection should be a contextual, narrative specific image pool. As the images would be created for this narrative, then we can have a hidden section at the bottom which with a click you can open the media library."*

Right and it will get worse fast: `MediaPicker` lists the whole stream library, and every approved slide registers into it, so ten slides per carousel per narrative floods it within a week. The narrative's own images are the ones you want on its text posts.

`MediaAsset` has no narrative field today (`media_id`, `stream`, `owner`, `url`, `kind`, `label`, `source`, timestamps), and the only link is that slide approval labels an asset `"<piece title> slide N"`, which is a string match and not a link. So the build is: add an optional `narrative_ref` to `MediaAsset`, stamp it when a generated image is registered, and have `MediaPicker` show that narrative's pool by default with the full library folded behind one click at the bottom. Existing assets have no ref and belong in the library section, which is the correct place for them.

**4. Refine what a carousel IS, across both platforms.** Marrs: *"whatever we have to do here has to be translated across LinkedIn and Instagram... those images would go into the LinkedIn carousel post and the Instagram carousel post."*

Current honest state, now visible on the Gate 4 card: the carousel says **Instagram, and only Instagram**, because the LinkedIn document post is blocked on two things (no PDF builder in the console, and Metricool document scheduling unverified). The slides are the shared asset; the container differs per platform. Once slides exist, turning them into a PDF is the next question.

**5. A second image model.** Nano Banana Pro (`google/gemini-3-pro-image`, about $2/1M) and ChatGPT Image 2 (`openai/gpt-5.4-image-2`, about $15/1M) are both strong on infographics and diagrams, against the console's photoreal-only Soul. `lib/marketing/higgsfield-models.ts` is the only file that needs to change. FLUX Kontext is commented out there because its endpoint 404s.

---

## Analytics (asked 25 August 2026)

**6. Rename the front page.** Done: "Whose content" is now "Content engine".

**7. Analytics in two places, always at the bottom.** Marrs: *"on the main engine page, where it shows everyone, so it's an aggregation of all those stats. And when you go into each of the streams, each one of those streams has an analytics section also. I think it's always going to be the thing at the bottom, because you don't want to look at that first... I'd at least like a mock-up there at the moment, and we're talking about as much data as we can and making it as visual as possible."*

The two screens answer different questions and should not be the same tiles with a filter:

| Screen | Question | Compares |
|---|---|---|
| Engine page | Is the engine running, and whose | **Streams** |
| Stream page | Which frame works in this voice | **Post types** |

Two tiles are real from day one off our own calendar data with no Metricool at all: the **shipped heat grid** (weeks by network) and the **frame mix shipped**. Everything else needs the spike below.

The load-bearing tile is the **frame ladder**: each post type ranked by median reach within one voice, with the voice's own median drawn as a tick. That is the tile that answers "do my contrarian posts beat my listicles on my own audience", which is the whole Learn loop. It must print `n` per row and fade rows under n=3, because a frame with two posts behind it is a rumour.

Person and company voices must never be pooled in a ranking: a personal profile takes 63% higher engagement than a company page at similar impressions, so pooled, Polynize ranks below every human every time and teaches nothing. `streamKind()` already exists to branch on.

**8. THE METRICOOL ANALYTICS SPIKE, and it is one call.** Everything in item 7 beyond the two real-now tiles rests on assumptions that a single authenticated request would settle.

Good news first: **yes, per-post analytics are real.** Metricool publishes a complete OpenAPI 3.0.1 spec at `https://app.metricool.com/api/swagger.json` (527 paths, linked from their own docs). Documented per-post endpoints with full typed schemas:

- `GET /v2/analytics/posts/linkedin`: impressions, uniqueImpressions, clicks, likes, comments, shares, engagement, videoViews, timeWatched, plus the reaction breakdown (praise, empathy, interest, appreciation, entertainment)
- `GET /v2/analytics/posts/instagram`: reach, impressions, views, **saved**, shares, **follows gained from that post**, interactions, engagement, hashtags used
- `GET /v2/analytics/reels/instagram`: averageWatchTime, reelsSkipRate, durationSeconds
- `GET /v2/analytics/timelines`, `/aggregation`, `/distribution`: the account-level engine, every sparkline and KPI
- `GET /v2/analytics/brand-summary/posts`: cross-network per-post feed in one call

What the spike must confirm, in priority order:

1. **Is Marrs on Advanced or Custom?** API access is documented as those tiers only. If not, the whole analytics section is a permanent mock.
2. **Does the join work?** The Learn loop rests on `ProviderStatus.id` (returned when we publish, and already stored as `external_ref`) matching the analytics `postId`. Both fields are documented; **nowhere does the spec say they are the same identifier.** If they do not match, the fallback is matching on `publicUrl` or on timestamp plus text prefix, both fragile. This single assumption decides whether analytics closes the loop or is a vanity dashboard.
3. **Do TikTok and Threads return JSON or CSV?** Both paths have a 200 with no content schema and a summary saying "Download a CSV", while typed JSON schemas for them sit in the spec referenced by zero paths.
4. **Does LinkedIn enumerate everything?** Metricool's own limitations page hedges on listing all published posts. Likely fine for posts published THROUGH Metricool, which is the inference to test, and it matters because his own LinkedIn is hand-posted (D41) and therefore published outside it.

Known constraints to design around, not discovered later:

- **Every endpoint defaults to Europe/Madrid.** Pass `Australia/Sydney` on every analytics call or every day bucket is shifted 8 to 10 hours. Same trap as D24 on the publish side.
- **No rate limits published anywhere.** Third-party reports say 429 with Retry-After. The engine page aggregates every stream, so it needs our own throttle, backoff and cache, not live passthrough.
- **No per-post lookup exists.** Every analytics endpoint is a date-range list, so showing one piece's numbers means fetching a window and filtering our side.
- **Pagination is half-documented.** `page.next` comes back but no cursor parameter is documented for consuming it. A wide range may silently return one page.
- **We must store our own snapshots regardless.** Metricool scopes data to a BRAND and holds no notion of our narrative, piece or post type, and states no retention window. Without our own periodic pull keyed to calendar entries there is no history, no trend, and no way to answer "did the Emergent AI carousel outperform". Budget the store as part of the build.
- **YouTube per-video is missing.** No `/v2/analytics/posts/youtube`. The only own-channel path is `/stats/youtube/videos`, whose summary reads "This method is deprecated". YouTube is account-level only until tested.
- **The Advanced Analytics add-on gates the best path.** Per-narrative "campaign dashboards" exist and would be ideal, but `PerformanceDashboardDto.locked` is documented as true once the brand is past the free limit without the add-on. Build on the raw per-post endpoints and treat dashboards as an accelerator.

---

## Video: evaluate ChatCut before building more of our own (asked 25 August 2026)

Marrs: *"for the video editing flow, I've found a possible better option called ChatCut. What I want to do when we get there is feed you a finished video I've created, and the raw video, and to see if our current video editing model or ChatCut can achieve the same thing."*

**A bake-off, not a decision.** He supplies a finished video he cut himself plus the raw footage, and the test is whether either path reproduces it: our own pipeline, or ChatCut.

Setup when we get there: **read `chatcut.io/claude` and install the ChatCut plugin.** Do not install it before the comparison is actually being run, and do not treat it as chosen: the point of handing over a known-good finished cut is that it is a real target with a real answer, which is a much better test than a feature list.

Worth knowing going in: everything after the shoot is deliberately absent from the console today (no cut, no render, no export, and no upload). So this is not "replace something that works", it is choosing what to build for a stage that does not exist yet, which is the right time to ask the question.

---

## Cadence and scheduling

**9. Nothing enforces capacity.** `nextOpenSlots` walks 60 days forward and always finds something, so an oversubscribed channel silently slides posts into future weeks. Improved in D46 (an unplaceable post is now reported rather than saved dateless) but there is still no warning that a lane is oversubscribed. With a maximalist posting strategy this stops being theoretical.

**10. The wave lock is per narrative, not per lane.** Two narratives on one stream planned minutes apart can take the same slot: both read the calendar before either writes. The precedent for the fix is in the same file, where the ship branch already re-reads each entry fresh.

**11. Two timezone sources for one post.** The wave picks a time from `getChannelSchedule(lane).timezone`; `publishEntry` sends it paired with `getPostingSchedule()[stream].timezone`. Both default to Sydney so it is invisible today. Typed slots (D46) make it categorical rather than cosmetic: the post the grid labels the morning video would go out in the afternoon.

---

## Known rough edges

**12. A calendar entry has no output identity.** The `texts_list` master serves both the listicle and the explainer, so unticking one and ticking the other leaves `missing` at 0 and the wrong draft stands in. The slot is always right; the copy can be wrong.

**13. Two competing routes into the calendar.** The wave, and "Prepare posts for N channels" on the text screen, which creates entries with no `scheduled_at` that the wave then has to repair.

**14. The autosave can drop an agreed hook.** On the Script screen the save loop re-checks only the script and the media refs, so a hooks or title change landing mid-flight is never re-sent while the indicator still says Saved. "Propose the arc" then refuses with the hooks visibly ticked on screen. The image screen's autosave does not have this bug and is the pattern to copy.

**15. No test runner beyond two suites.** `npm run test:marketing` (111 assertions) and `npm run test:blueprint`. Everything else is unverified by anything but a typecheck, and `tsc` cannot see a client component importing server code, which shipped a 500 once already (D47).
