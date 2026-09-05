# Analytics, attribution and scale: the deep dive

**Written 3 September 2026, for Marrs. Revised the same day after his feedback.**

> **One word first.** The content strategy v0.2 calls them *lanes*. The team's word is **use case**, and Marrs has asked for that throughout. This document says use case everywhere; where the strategy's YAML says `lane_id` it means the same thing. The brief for the next phase: turning Metricool's numbers and polynize.ai's traffic into decisions about what to post more of, across more brands, to drive more people into the lead magnets and on to discovery calls, trials, proposals and delivery.

Two inputs: a research note from another agent on Metricool autolists, and Marrs's own framing, which takes precedence. Everything below was checked against Metricool's OpenAPI spec (1.2MB, downloaded), Metricool's own help centre, Vercel's Web Analytics API documentation, and this codebase. Where a claim could not be verified it is marked as such.

---

## The plan in plain English, for the project manager

Marrs, 5 September: *"You have to report back to me as if I'm a non-technical project manager... what does it look like, how does it work on the platform, and is it hitting our desired target?"* This section is that. Everything below it is the engineering version of the same plan and can be skipped.

### The problem in one line

On day one a viewer commented "Map", ManyChat sent them a lead magnet, they completed it and booked a meeting. **Nothing recorded which post started it.** The whole plan is about fixing that one gap, then using the answer to decide what to post more of.

### Where the build is

| Step | Status |
|---|---|
| 1. Every post gets its own tracking label | **Built and live, 5 September (D96).** Copy buttons on every calendar entry; the link in the hand-post brief; the first comment on LinkedIn. |
| 2. polynize.ai remembers the label | **Built and live, 5 September (D97).** Works today for every labelled arrival. **One thing only Marrs can do:** paste `supabase/migrations/0014_lead_attribution.sql` into the Supabase SQL editor (Supabase dashboard → SQL Editor → New query → paste → Run). Until then leads still land, without their label, and the server log says so. |
| 3. The console reads the numbers back | **Built, 5 September (D98).** Clicks, Leads and Bookings tiles; a By use case table with posts per lead; clicks and leads per post; the url join; Pull now runs it as a sixth step and a nightly job runs it at 3:10am Sydney. **First proof is the first Pull now on the live console:** a number, or a sentence saying which key is wrong. |
| 4. Every Story is filed under a use case | **Built and live, 5 September (D96).** Six chips at Gate 1 with April's suggestion; a select on the Story screen and the caption screen. |
| 5. The leaderboard | Next. |
| 6. The lead carries its use case | **Built and live, 5 September (D97).** Use case only; no partner field (Marrs, 5 September: partner routing is an internal decision and stays open). A chip on each CRM row. Needs the same SQL as step 2. |
| 7. Winners repeat themselves | Last. |

### The seven steps, what you see, what it answers

| # | In plain English | What you see in the console | The question it answers |
|---|---|---|---|
| 1 | **Every post gets its own tracking label.** Each post the console prepares comes with a link that quietly says "I came from this post, on this person's channel, about this use case." The viewer sees a normal polynize.ai link. Only we read the label. | The link on the post and in the hand-post brief. You paste it into the ManyChat flow for that post. | Which post did that? |
| 2 | **polynize.ai remembers the label.** Today the site drops it at the door. After this, when someone arrives on a labelled link and completes a lead magnet, the label is written onto their lead record. | Nothing new to look at. The lead record just knows where it came from. | Which post produced this lead? |
| 3 | **The console reads the numbers back.** Nightly, and when you press Pull now, it asks Metricool for reach and saves and asks Vercel for clicks and completions, and puts them on each post. **This is the step that uses the three keys you just added.** Nothing reads them yet. | On each post: how many saw it, how many clicked, how many completed a lead magnet. | Is this post working? |
| 4 | **Every Story is filed under a use case.** When April proposes a Story it is tagged with one of the six (hiring, sales, learning and development, security, AI capability, deal-side). She picks a default; you can change it at Gate 1. The tag rides on every post and every link. | A use case dropdown at Gate 1. A use case column on the calendar. | What are we posting about, and for whom? |
| 5 | **The leaderboard.** For each use case, the post types ranked by lead-magnet completions per post, with how many posts stand behind each row. Rows with fewer than three are greyed out because two posts prove nothing. | A table on the analytics panel. | What do we make more of next? |
| 6 | **The lead knows its use case.** The lead record in the console's CRM gains which use case it came from and how sure we are (from the link, or guessed), and the existing stage keeps moving: new, contacted, meeting, proposal, won. Who it goes to is decided by the team, by hand, for now: partners do not use the CRM, and Marrs wants that left open. | A use case on the lead. A stage that moves. | Is this turning into revenue, and from which use case? |
| 7 | **Winners repeat themselves.** A button on a proven post that sends it to Metricool's repeating list so it keeps going out on quiet slots, with a fresh line of copy each cycle. | A "make this evergreen" button on posts that earned it. | How do we double down without more production? |

### What changes for you, day to day

- **Steps 1 and 2 are invisible plumbing.** Nothing new to do except paste the console's link into each ManyChat flow instead of the plain one.
- **Step 3 is when the dashboard starts telling the truth.** Reach today; clicks and completions per post from then on.
- **Step 4 adds one dropdown at Gate 1.** April fills it; you correct it if she is wrong.
- **Step 5 is the decision screen.** It is the only screen you need to read to decide what gets approved next week.
- **Step 6 is the CRM you asked for.** The lead carries which use case it came from; the team decides who takes it.

### Is it hitting the target

The strategy's targets are 10 to 25 lead-magnet completions a week, and 3 to 8 discovery calls a month. After step 3 the panel shows completions per post and per week against the first number. After step 6 it shows bookings against the second, and the partner they went to. Until step 3 lands, the honest answer to "is it working" is what you already know: one post, one completion, one booking, and no record of which post.

### Security, in one paragraph

The label on the link is the standard convention every marketing team uses; it carries a post number and a use case, never a person's name or email. The three keys sit in Vercel's environment, marked sensitive, so they cannot be read back even by us, only replaced. The console talks to Metricool and Vercel from the server; nothing runs in a visitor's browser. No customer data leaves our systems.

### The words, translated

- **Tagged link, UTM.** A normal link with a label on the end that the site reads and the viewer ignores. UTM is the industry's name for the label format.
- **First-party capture.** The website itself writes the label onto the lead record, rather than a third party guessing later.
- **URL join.** After a post goes live, the console stores the post's public web address so the numbers Metricool reports can be matched back to our record of the post.
- **Use case on the Story, stored as data.** The six use cases from your strategy become a list the console holds, so April and the calendar read them instead of a developer typing them in.
- **Frame ladder.** The leaderboard in step 5. A frame is a post type; the ladder is those types ranked.
- **Autolist.** Metricool's name for a repeating list of posts.

### The decision you need to make

Only one: **go**. The six use cases are taken from your strategy as written; if you want different names, say so at step 4.

---

## 0. First, where I was wrong

**D79 said Metricool has no queue: "528 paths, none of them a queue."** That is false. Metricool calls it an **autolist**, and there are 25 endpoints under `/lists/*` in their spec: create and enable a list, add and reorder posts, and create and update the weekly timing rows. I searched for my vocabulary ("queue", "autoschedule") rather than theirs ("lists"). The other agent found it because they read the product, not the spec.

The console-side queue built in D79 still stands, for reasons in section 2 that are now a deliberate decision rather than a mistaken premise. But the premise was wrong and the decision log says so.

---

## 1. The autolist research: what holds, what does not

### Holds, verified

| Claim | Verified against |
|---|---|
| Autolists exist with a full API: `/lists`, `/lists/posts/add`, `/lists/timing/create`, `/lists/update` | Metricool OpenAPI spec |
| **Per-network settings are list-level, not post-level**: `igType`, `igShowReelOnFeed`, `ytType`, `ytPrivacy`, `ytMadeForKids`, `tkPrivacy`, `tkDisableComment`, `inPreviewIncluded` all sit on `/lists/update` | Spec, parameter list of `/lists/update` |
| Therefore one list per network, split again where presets differ (Shorts vs long-form) | Follows from the above |
| 200 posts per list; over that, posts do not publish | Metricool help centre |
| `Repeat` makes the list circular; off is a drain-down queue | Metricool help centre |
| Fair use: 600 posts per brand per month triggers a manual review and can pause publishing | Metricool fair use policy |
| TikTok connected as a Personal account loses audience data and the trending sounds library | Consistent with what our own D78 probe returned for the brand profile |
| Queue starvation is the operational risk, not the cap | Sound reasoning |
| Validate assets per network before pushing | Sound, and our kit catalogue already carries the per-network specs to do it |

### Does not hold, or needs correcting

**"The URL shortener gives you click stats."** No. Metricool's own help article says, verbatim: *"Unlike other link shorteners that track interactions with your content, Metricool's shortener doesn't track anything."* And their UTM builder page says *"Metricool does not offer UTM analytics."* Their shortener is a privacy feature, not a measurement one. The only click figure Metricool holds is `clicks` on LinkedIn post analytics, which LinkedIn itself reports. **Click measurement has to be ours.** Section 3.

**"Move the queue to autolists."** Not for fresh content. See section 2.

**The frequency benchmarks** (Sprout, Hootsuite) optimise engagement per post for one brand's one account. Marrs's goal is different: saturation across many brands and channels, each feeding a use case. Under that goal the right question is not "how many posts a week on this account" but "how many distinct surfaces, each posting at a rate the platform rewards." Two strong posts a day on twelve accounts beats twelve posts a day on two. The per-account numbers in the research are reasonable ceilings per surface; they are not a strategy.

**Timezone.** The research assumed an Australian audience and said so. That is the right caveat and the right first question: where the buyers of a capability-mapping product are is not necessarily where its founder is.

---

## 2. Two queues, deliberately

The console queue (D79) and Metricool autolists do different jobs, and the console's content volume is what makes the split matter: one Story is 16 posts across four networks by default, and the target is many brands.

### The console queue is for fresh content, because attribution lives there

Every calendar entry the console creates knows things Metricool never will:

- **which frame it is** (contrarian, numbered rules, hard moment, reel two of three);
- **which Story and which use case it serves**;
- **its slot kind** (LinkedIn morning is video, afternoon is stills);
- **whether it is hand-posted** (Marrs's own LinkedIn never touches Metricool);
- **its timezone**, stamped rather than re-derived.

**The frame ladder, defined**, since Marrs asked. A *frame* is a post type from the catalogue: contrarian post, numbered rules, hard moment, field report, reel, carousel, and so on. The *ladder* is those frames ranked, within one voice and one use case, by what they earned: today reach, soon magnet completions per post. Each rung prints how many posts stand behind it, and a rung with fewer than three is faded, because a frame with two posts behind it is a rumour rather than a result. It is a ladder rather than a bar chart because the question it answers is ordinal: which frame do we make more of next. Metricool cannot draw it because it does not know our frames. An autolist is a FIFO with a timetable; feed it and the frame identity is gone at the door unless we keep our own record of what went in, which is exactly what the calendar entry is.

### The two, explained plainly

Think of a bakery. **The console queue is the morning bake.** Every day new bread comes out of the oven, each loaf labelled with what it is and who it is for, and goes on the shelf in the order the shelf has room. It sells once. The label is how we later know which loaves sold and to whom.

**An autolist is the display case of the proven sellers.** Once we know the sourdough always goes, a few loaves of it sit in a case that refills itself: sell one, the next comes forward, round and round. Nothing new is decided; it just keeps the good thing available.

**They connect at one point.** When the morning bake's labels tell us a loaf is a proven seller, we move that recipe into the case. The console reads its own numbers, picks the winner, writes it into the Metricool autolist for that network via their API, and keeps the autolist item id on our record so the recycled post still knows which frame and use case it came from. Fresh through ours, proven through theirs, and the labels never come off.

### Autolists are for the evergreen tier, and that is the "double down" mechanism

Marrs: *"If we find one type of content that's working, we create a channel specifically for that content and double down."*

That is what `Repeat` is for. A proven post goes into a circular list on off-peak slots and recycles. The console decides what is proven (from the numbers in section 3), writes it to the list via `/lists/posts/add`, and records the autolist item id on the entry so the recycled post still joins back to its frame and use case. Fresh content drains through our queue; winners circulate through theirs. The fair use rule about repetitive identical content means recycled copy should vary between cycles, which April can do.

**To build:** an autolist client (list, add, timing), a "promote to evergreen" action on a post, and the item id stored on the entry. Not before section 3 exists, because "proven" needs a number.

---

## 3. Click-through: the honest answer, and the gap that makes it zero today

### The gap first, and a correction to how I first put it

I wrote that click-through was "zero by construction." **Marrs corrected the framing, and he is right:** the first comment is one of several ways a click happens, not the only one. The others in use are **"comment MAP below"** (the viewer comments a keyword and the link arrives in reply or by DM) and **ManyChat**, which automates that on Instagram and Facebook: a keyword comment on a specific post triggers a DM carrying the link. Those clicks are real and they are the ones the strategy leans on for reach, because a post with no link in it travels further and the link arrives to someone who asked for it.

What IS true, stated precisely: **the posts the console publishes through Metricool carry no link and no first comment**, because nothing ever writes `first_comment`. The kit declares the placement, the entry has the field, the client sends it, and no code fills it. So the console-published half of the funnel is dark, while the ManyChat and manual-reply half is lit but **unattributed**: a DM link with no `utm_content` cannot be tied back to the post that earned it.

**And it is already working.** Marrs, 3 September: ManyChat is set up on TikTok and Instagram; a viewer comments "Map", a flow DMs them the lead magnet. *"I posted the first bit of content today. The lead flow worked perfectly. Someone went and used one of the lead magnets on Polynize.ai, and they booked in a meeting with me straight away."* One post, one completion, one booking, on day one. **That is the whole funnel, proven end to end, before any of this is built.** What is missing is only that nothing recorded which post did it.

**Design consequence:** the link builder in this section has to serve three delivery paths, not one, and `utm_medium` tells them apart. ManyChat is the primary path on Instagram and TikTok and it is his to run; the console's job is to give each post the link its ManyChat flow should carry. LinkedIn has no ManyChat, so there the first comment written by the console and the owner's manual reply do the same job:

| Path | `utm_medium` | How `entry_id` gets into the link |
|---|---|---|
| First comment, written by the console | `social` | The console writes it at prepare time |
| ManyChat DM after a keyword comment | `dm` | The ManyChat flow for that post is created with the post's link; per-post triggers exist in ManyChat, so one flow per post carries its own `entry_id` |
| Manual reply by the owner | `reply` | The console shows the owner the exact link to paste, on the entry, so it is never typed by hand |

The console cannot drive ManyChat, and should not try. What it can do is **hand every post its one correct link**, on the calendar entry and in the hand-post brief, so whichever path delivers it, the click carries the key.

**And the site discards attribution at the door.** The nurture design brief (27 August) found it and asked the posting side to set `utm_campaign` per lane (its word; ours is use case). The site side has not captured UTMs yet: `/map-your-team` reads only `?start=1`, the `sessions` insert stores `{ id, phase }` and nothing about arrival, and the `leads` row has `source: 'blueprint'` and nothing else. **Both halves of the join are missing.** That is good news in one way: nothing has to be undone.

### Three sources of click data, ranked

**1. First-party, ours.** polynize.ai is our Next.js app. Capture `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` and the referrer on the first request into a funnel, persist them on the session, write them to the lead when the magnet completes. This needs no plan, no vendor, no export, and it is the only source that can follow a click **through** the funnel: landing, magnet started, magnet completed, email captured, blueprint opened, booking clicked. The nurture brief already specified the `leads` columns (`utm jsonb`, `lane`, `lane_confidence`; the console will name them `use_case` and `use_case_confidence`). **This is the join, and it is under our control.**

**2. Vercel Web Analytics API.** Real and now public: `GET /v1/query/web-analytics/visits/aggregate` grouped by `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`, `referrerHostname`, `route`, and custom events by `eventData/<prop>`. Filters are OData. **Gated by plan:** UTM parameters are collected only on **Pro with Web Analytics Plus** ($10/month add-on) or Enterprise; custom events need Pro; the reporting window is 1 month on Hobby, 12 on Pro, 24 on Plus. The site's own `track()` comment notes that custom events silently drop on Hobby. **Which plan the team is on decides whether this source exists at all.** Question for Marrs. Even on Plus this source is a cross-check on source 1, not a replacement, because it cannot see magnet completion or the lead.

**3. Metricool, LinkedIn only.** `LinkedinPost.clicks` is a real field their per-network analytics return, and we already pull LinkedIn. It is the platform's own click count and it joins to our entry by url (D84's second read). Useful as a LinkedIn-only reach-to-click ratio. Nothing equivalent exists for the other three networks in their API.

### The link, and the key inside it

Every link the console publishes should be built by one function, never by hand:

```
https://polynize.ai/<magnet>?utm_source=<network>&utm_medium=social
  &utm_campaign=<use_case>&utm_content=<entry_id>
```

- `utm_campaign = use_case` is what the nurture brief asked for: it resolves which of the six use cases a lead belongs to, which the magnet alone cannot (four lanes share one magnet).
- `utm_content = entry_id` is the exact join back to the calendar entry, and through it to the frame, the Story, the use case, the stream and the slot. **One id, and every question in Marrs's list becomes a query:** which posts drove clicks, which frames drove completions, which network converts.
- The link goes where the kit already says it goes: first comment on LinkedIn, caption plus first comment on a document, the post url itself for an article.

Metricool's shortener would rewrite the link to `t.mtrbio.com/...` and, by their own statement, record nothing. **Turn the shortener off** on our brands so the UTM survives to our server.

---

## 4. The funnel we can measure end to end

| Stage | Where it is recorded | Exists today |
|---|---|---|
| Post published | Calendar entry, with frame, use case, stream, slot | Yes |
| Reach and engagement | Metricool per-post analytics, joined by url after publication | Pull exists (D86); the url join is the next commit |
| Click | First-party landing capture with `utm_content = entry_id` | **No** |
| Magnet started | `sessions` row; needs the attribution stamped on insert | Row yes, stamp no |
| Magnet completed, email captured | `leads` row; needs `utm` and `use_case` | Row yes, columns no (specified in the nurture brief) |
| Blueprint opened, forwarded | Not tracked; the nurture brief calls this the single strongest buying signal and it is invisible | **No** |
| Discovery call booked | `booking_click` event fires; the booking itself happens on Marrs's **Google booking page** (not Calendly, corrected 3 September) | Click yes, booking no. Google Calendar appointment schedules expose bookings through the Calendar API, so the same close is available |
| Trial, proposal, paid | The console's own CRM (`/console/leads`) | **In scope** (Marrs, 3 September): the CRM has to carry the lead from magnet to paid with the use case and the partner it was routed to, so the loop closes on revenue rather than on completions |

The first four rows are the marketing engine's own loop and every one of them is buildable now. Once the click and the lead carry `entry_id`, the frame ladder stops ranking by impressions and starts ranking by **magnet completions per post**, which is the metric that actually tracks his goal.

---

## 4b. The platforms, from the horse's mouth

Marrs: *"All the major social media platforms have changed to pretty much AI-native algorithms. I think you need to do a bit of research on that... straight from the horse's mouth."*

Checked 3 September 2026. The table separates what each platform has **itself published** from what the trade press asserts, because the two are routinely conflated and only the first is evidence.

| Platform | Most recent official statement | What it says, in their words | What the trade press adds that is NOT in the official source |
|---|---|---|---|
| **LinkedIn** | Engineering blog, **12 March 2026**, "Engineering the next generation of LinkedIn's Feed" | "a new advanced ranking system, powered by LLMs and GPUs, that better understands what a post is actually about." Signals: profile ("industry, experience, skills and geography"), engagement ("what you've read, liked, commented on, returned back to, or simply scrolled past"), treated "as an ordered sequence rather than independent events", plus "format, author information, engagement counts, article metadata, and post text". Positive engagement named as "long dwells, likes, comments, shares". **No weighting disclosed. Nothing on links, originality or AI content.** | A "60% link penalty", "personal profiles get 561% more reach", "generic AI content is downranked". The links page on linkedin.com is aggregated member opinion, not LinkedIn, and one contributor quotes a LinkedIn account manager (April 2026) saying put the link in the first comment. Directionally consistent with our kit rule; not an official figure. |
| **Instagram** | about.instagram.com, "Instagram Ranking Explained", **31 May 2023** (still the current page) | Reels: "which reels you've liked, saved, reshared, commented on"; "the majority of what you see is from accounts you don't follow"; and it makes "less visible reels that have already been posted on Instagram". Explore: popularity matters "much more in Explore than in Feed". | Mosseri's 2025 to 2026 statements (watch time, likes per reach, **sends per reach** as the three signals; sends weighted for reaching non-followers; originality rules extended to photos and carousels in April 2026) come from his own Instagram posts and were read here through trade summaries, not the posts themselves. Treat as likely, verify on his account before betting a strategy on the exact ordering. |
| **TikTok** | Newsroom, "How TikTok recommends videos #ForYou", **June 2020**; the 2025 newsroom posts add feed controls, not ranking changes | Signals: "the videos you like or share, accounts you follow, comments you post, and content you create"; "captions, sounds, and hashtags"; "language preference, country setting, and device type". Completion is explicit: "whether a user finishes watching a longer video from beginning to end, would receive greater weight". And: "neither follower count nor whether the account has had previous high-performing videos are direct factors". Region and language get "lower weight relative to other data points". | "Followers first, then a test audience" in late 2025; longer videos favoured; posting frequency rewarded. None of it is in TikTok's published material. The transparency centre page is client-rendered and could not be read. |
| **YouTube** | Blog, "On YouTube's recommendation system", **15 Sept 2021**; and **14 July 2026**, the Shorts-to-long-form guide | 2021: clicks, watchtime, survey "valued watchtime", shares and likes, dislikes. 2026: the Related Video link "routes traffic to any long-form video" and Shorts are framed as discovery for other segments; "match the viewer's intent". **Nothing official on Shorts and long-form being separately ranked.** | "The Shorts and long-form algorithms have been formally separated", "satisfaction replaces watch time", "hybrid creators grow 3x faster". Plausible, unsourced to YouTube. |
| **X** | The open-source repo, **last updated 14 August 2026** | The ranker "predicts probabilities across multiple action categories": engagement ("favorite · reply · repost · quote · share · share via DM · share via copy link"), clicks (including **link** click), attention (dwell, dwell time), follow, and negatives ("not interested · mute author · block author · report · not dwelled"). "Final Score = Σ (weight_i × P(action_i))", with an **out-of-network discount** on unfollowed authors and a **new-author boost**. **No Grok in the ranking code.** | "Replies count 2 to 3x likes", "links get zero engagement for non-Premium accounts", "Grok reads the tone of every post". The weights are in `home-mixer/params/param.rs` and could be read for the first claim; the other two are not in the repo. |

### What this means for the console, and it is less than the headlines suggest

1. **The direction of every platform is the same and it favours us.** Rankers that read *what a post is about* and a viewer's *recent sequence of interest* reward accounts that are consistently about one thing. That is the argument for one use case per channel (section 5) made by the platforms themselves, and it is the strongest evidence in this document for the Phase 2 structure.
2. **Completion, saves, shares and dwell are the currency, not likes.** TikTok says completion outright; Instagram names saves and reshares; X scores dwell and share-via-DM; LinkedIn names long dwells. The strategy's "saves carry about 5x a like" is in the right spirit even if no platform publishes the multiplier. **The panel should show saves and shares where the API gives them**, which today is Instagram's per-network feed and LinkedIn's.
3. **Originality is enforced, on Instagram explicitly.** The same file on two accounts on one platform is the one scaling move to avoid; section 5.
4. **Nothing official says how often to post.** Not one platform publishes a cadence. The Sprout and Hootsuite figures are observed averages of what brands do, not what platforms reward. Cadence is an output of production capacity, exactly as the strategy's section 06 puts it, and the right test is the frame ladder, not a benchmark.
5. **Links.** Only X publishes anything, and it is that a link click is a scored positive action. LinkedIn publishes nothing; the first-comment convention rests on member reports and one quoted account manager. The kit's rule stands as the conservative choice, and the ladder will tell us if it costs reach on our own posts.

**A note on method.** Four of the five official sources are older than the "past month" and only LinkedIn's is from 2026. That does not mean the platforms have not changed; it means they have not said so in writing. Everything dated 2026 about Instagram, TikTok and YouTube ranking in this table is secondary. The console should measure rather than believe: the frame ladder per use case is the only source of truth we control.

---

## 5. Scale: use cases, partners and the data model

Marrs, corrected on 3 September: *"When we say many brands, that brand may be a generic brand like Leadership Central. It just has content on one of the use cases and points to Polynize. It's not that we make more channels under Marrs' brand. We make more channels under the different use cases. But ultimately that strategy is Phase 2. We're just trying to get our current use cases and current channels maximised."*

And the strategy shift from the leadership meeting: **partner growth**. Marketing still brings the leads in; the leads then go to partners by specialty. Patricia takes the HR use cases and talks to CHROs and CEOs.

### What the model has and what it lacks

The console has **streams** (who the content is for) and Metricool has **brands** (accounts), mapped one to one. It has **frames** (what kind of post). It does not have **use cases** (what the post is about and who it is for), and the strategy defines six of them with Kit segments: `ai_capability_lead`, `sales_lead`, `ld_lead`, `hiring_manager`, `security_lead`, `deal_side`.

**Use case is the missing axis, and it is the one the strategy is organised around.** A Story is about something; that something is a use case. Add it to the Story (chosen at Gate 1, defaulted by April from the idea), carried to every piece and every entry, written into every link as `utm_campaign`. Then:

- the frame ladder can be read **per use case**, which is the question "what works for hiring managers" rather than "what works";
- the nurture side gets its segment for free, from the link;
- **the CRM gets the routing key for free too**: a lead whose link says `hiring_manager` is Patricia's before anyone reads it.

### Use-case channels: my view, since he asked

*"Instead of having one Polynize channel, we may have a channel across the relevant social media platforms that target the specific user and narrative... any leads that came from there, we could really tailor the narrative for those leads. What are your thoughts?"*

**It is the right end state, and the reasoning is stronger than "more surface area."** Three things point the same way:

1. **The platforms now rank by what an account is consistently about.** LinkedIn's March 2026 engineering post describes a model fed two to three months of a member's activity and a post's own text and format to decide relevance; TikTok's own statement is that recommendations follow interests expressed and refined over time. An account that posts one use case teaches the ranker one thing. The Polynize page carrying all six teaches it six, and gets classified as none.
2. **A use-case channel is a routing device.** Every lead from "Leadership Central" is a leadership lead. No inference, no scoring model, no guesswork about which partner it belongs to. The channel IS the segment.
3. **It is the only structure where a partner can eventually own their own surface.** Patricia's HR channel becomes hers to speak from, with the console making the content.

**But not yet, for the reason he gave.** A channel with no proven post types is a channel with nothing to say consistently. Phase 1 is: one Polynize page, six use cases tagged, frame ladder per use case. Phase 2 opens a channel for a use case the moment its ladder shows a frame that converts. **The console should be built so that opening a channel is a configuration act**: a new stream mapped to a new brand, inheriting the use case's spec, voice and kit defaults. That is what makes "we found what works, spin a channel" a Tuesday afternoon rather than a project.

### The same video on two brands

*"One video about hiring could go out on a Polynize channel as well as a hiring-specific brand channel. I'm not sure if that's going to work."*

**Metricool's side: fine.** Their fair use threshold is per brand (600 a month) and their spam concern is "repetitive publication of identical content"; the same video with different copy on two brands is two posts on two brands, each well under threshold.

**The platforms' side: this is where the risk is.** Instagram's own ranking page says it makes "less visible reels that have already been posted on Instagram", and the 2026 trade press reports the originality rule extended to photos and carousels and to accounts that mostly repost. TikTok has long suppressed duplicate uploads. **So the same file on two accounts on the same platform is the one thing to avoid.** The safe version is what the kit already does: one recording, different cuts. The hiring channel gets the cut with the hiring hook; the Polynize page gets a different cut of the same session. Same idea, different file, different copy.

### Brands as a scaling unit

More brands is more surface area, and it is cheap on the console side: a brand is a stream mapping and a schedule. The constraint is content per surface: the platforms reward accounts that post consistently at a sustainable rate, and each brand needs its own voice doc or the use case's. The kit already produces 16 posts per Story; the question becomes how many Stories per use case per week the team can approve, not how many posts the system can make. **Approval is the bottleneck, so the analytics should point approval at the frames and lanes that convert.**

**Fair use** is 600 posts per brand per month. At 16 posts per Story that is 37 Stories a month on one brand before Metricool looks. Not a constraint at any realistic approval rate.

---

## 5c. The content strategy v0.2, mapped onto the console

Received 3 September. It is the document the console should be built against, and most of it already has a home. What does not, in order of how much it changes:

| Strategy says | Console today | Gap |
|---|---|---|
| **Six use cases** (the strategy says lanes), each a YAML agent spec (section 09): `lane_id`, `stream`, `priority`, `owner`, `narrative`, `doer`, `buyer`, `buyer_kpi`, `angle`, `formats`, `platforms`, `cta`, `magnet`, `landing_page`, `segment`, `proof`, `avoid` | No use-case object. Streams are people; frames are post types | **Store the six specs verbatim as data.** A Story picks a use case at Gate 1; its `angle`, `avoid`, `cta`, `magnet` reach April's prompt; `segment` becomes `utm_campaign`; `magnet` plus `landing_page` become the link |
| **Per-owner output**: Polynize 21 pieces; Marrs 8 to 10; Shourov 5 to 6, **no video**; Julian 5 to 6, **no talking to camera**; Kristin 1 to 2, **LinkedIn only** | The kit defaults on company versus person only, so Shourov's default kit offers three Reels and Kristin's offers TikTok | **Per-stream kit defaults**, from the strategy's exclusions. One table, read by `kitRows` |
| **Platforms include X** for Shourov and the page | X is in the channel list, has no queue, no frame, no Metricool mapping in the kit | A LinkedIn text frame republished to X (Metricool's `twitter`), 280 characters, is the cheap version. Later |
| **"No magnet, no post"** | Nothing checks that an entry carries a link | Enforce at prepare: an entry whose use case has a magnet gets the link; a use case with `magnet: TO_BUILD` (cyber, acquisition) is flagged, not blocked |
| **Measure views, saves, completions. Saves carry about 5x a like** | Impressions, interactions, engagement rate. No saves | `saved` is on Instagram's per-network feed and not on the brand summary; add the per-network pull for it. Completions need section 3 |
| **Run each frame at least three times before judging** | The frame ladder design already fades rows under `n = 3` | Agreement, not a gap |
| **Series beat one-offs** | Nothing groups posts into a numbered series | A `series` on the Story, printed into the copy, is small and testable |
| **Section 08 targets**: completions 10 a week by month 3, 25 by month 6; discovery calls 3 then 8 a month | The panel has no targets | Target lines on the completions and calls tiles once those numbers exist |
| **Section 05 wants the catalogue as a testing calendar**: which frame, which use case, which week, what result keeps it | The catalogue exists (20 outputs); nothing schedules a test | The frame ladder by use case IS the result column; the calendar column is a Story per use case per fortnight, which is the wave |
| **Daily podcast clips at 10am, automatic** | Running | Nothing |
| **Polynize page carries all six use cases (its word: lanes); personal profiles carry reach** | Hand-post on Marrs's LinkedIn (D41) already encodes half of this | The `owner` field on the use case makes the other half explicit |

**The one structural change is the use-case object.** Everything else in the table hangs off it: the kit defaults read its `formats` and `platforms`, the link reads its `magnet` and `segment`, April reads its `angle` and `avoid`, the ladder groups by it, the CRM routes by it, and a use case that earns it gets a brand.

---

## 6. The build order

Each step unlocks the next, and each is small enough to ship and check.

1. **Links with the key.** One function builds every outbound link with the four UTMs; `first_comment` is populated at prepare and by the wave from the kit's placement rule; the Metricool shortener is off. *Unlocks: any click can be attributed at all.* Small.
2. **First-party capture on polynize.ai.** Middleware or the first-touch pages read UTMs and referrer, stamp them on the session insert, write them to the lead on completion, per the nurture brief's columns. *Unlocks: source 1, and the use case for nurture.* Small, but it is public-site code and the nurture brief marks it as that session's to build; coordinate rather than collide.
3. **The url join.** The second read after publication (`GET /v2/scheduler/posts` carries `providers[].publicUrl`, proven in D84) stores the platform url on the entry; analytics rows join on it. *Unlocks: real per-post reach against our frames, and D85's "posted" becomes confirmed.* Small.
4. **Use case on the Story.** One field, defaulted by April, carried down, written into the link. *Unlocks: everything per use case, and partner routing in the CRM.* Small in code; the six specs from the strategy's section 09 stored as data.
5. **The frame ladder, by use case, by conversion.** Post type ranked by magnet completions per post within one voice and one use case, with `n` per row and rows under `n = 3` faded because a frame with two posts behind it is a rumour. *Unlocks: the decision "make more of these".* Medium.
5b. **CRM: the lead carries its use case and its partner.** In scope as of 3 September. The `leads` row gains `use_case`, `partner`, and the stage it reached (magnet, booked, trial, proposal, paid), so the ladder can eventually rank frames by revenue and not only by completions. Medium.
6. **Evergreen autolists.** Promote a proven post to a circular list per network, item id stored on the entry, copy varied per cycle. *Unlocks: the double-down.* Medium.
7. **The nightly pull**, once the button is boring. Small.

Steps 1 to 3 are a week of work and they turn the analytics panel from "how much reach" into "how many leads, from which posts." Step 5 is the one that changes what gets approved. Step 5b is what makes the partner strategy measurable.

---

## 7. Questions Marrs answered, 3 September 2026

1. **Vercel plan: Pro, and Web Analytics Plus is now ON** (Marrs, 3 September). So UTM dimensions are being collected from today. Two more things for the console to read them, both created in the Vercel dashboard and never pasted in chat:
   - **An access token.** Avatar (top right) → Account Settings → Tokens → Create. Name it `pam-analytics-read`, scope it to the polynize team, expiry one year. Copy it once; Vercel never shows it again.
   - **The site's project id.** Open the polynize.ai project → Settings → General → scroll to Project ID (starts `prj_`). The team id is on Team Settings → General (starts `team_`).
   - Put them in the **console** project's environment variables as `VERCEL_ANALYTICS_TOKEN`, `VERCEL_ANALYTICS_PROJECT_ID`, `VERCEL_TEAM_ID`, Production and Preview, then redeploy. The console then queries `api.vercel.com/v1/query/web-analytics/visits/aggregate` grouped by `utmContent`, which is the entry id.
2. **Audience: Australia first, the US second. Asia is the partners'.** Two regions, so one grid can serve both: each network's two daily slots land in one Australian and one US morning. Decide the exact times once the first-party numbers show where clicks come from, since `utm` plus the referrer country answers it in a fortnight.

   **Posting to a US audience from Australia.** TikTok's own statement is that "language preference, country setting, and device type" are signals that carry "lower weight relative to other data points", and that follower count is not a factor. Trade sources describe the account region as separate from where a video is distributed, with the posting IP, language and timezone shaping the first test audience. So a US-facing sub-brand is not locked out by geography; it is shaped by the signals it posts with. **Do not use a consumer VPN for it**: shared datacenter IPs are ignored or penalised. If a US sub-brand is ever built, it wants a dedicated US posting path, US-hours slots and US-idiom copy. Phase 2.
3. **"Use case", not "lane".** The strategy doc used *lane*; the team's word is *use case* and this document now says so throughout. What the console lacks is the use case as a stored object; section 5.
4. **The strategy document**: `polynize-content-strategy-v0_2.md`, received. Section 9 of it is already an agent spec per use case (it says lane), in YAML, which is the schema the console's `lane` object should hold verbatim: `lane_id`, `stream`, `priority`, `owner`, `narrative`, `doer`, `buyer`, `buyer_kpi`, `angle`, `formats`, `platforms`, `cta`, `magnet`, `landing_page`, `segment`, `proof`, `avoid`.
5. **The shortener: decided.** Marrs: *"do what you think is best for the system."* **Off**, and the console builds every link itself with the four tags, so nothing between us and the reader can rewrite it. If a short, clean link is ever wanted for a spoken CTA ("go to polynize.ai/map"), it should be **ours**: a redirect route on polynize.ai that expands to the tagged link, so the click is still counted first-party. Internal and API-connected, which is his stated preference.
6. **TikTok business account**: committed, his to do.

---

## Sources

- Metricool OpenAPI spec, `https://app.metricool.com/api/swagger.json`, read 1 and 3 September 2026
- [Metricool: Fair Use Policy for Social Media Scheduling](https://help.metricool.com/en/article/fair-use-policy-for-social-media-scheduling-oh90gv/)
- [Metricool: Schedule content from an Autolist](https://help.metricool.com/en/article/schedule-content-from-an-autolist-zj5crc/)
- [Metricool: Scheduling content with links](https://help.metricool.com/scheduling-content-with-links-6kqha) (the shortener "doesn't track anything")
- [Metricool: UTM Builder while planning your content](https://help.metricool.com/utm-builder-while-planning-your-content-qm0de) ("Metricool does not offer UTM analytics")
- [Vercel: Query Web Analytics with the API](https://vercel.com/docs/analytics/web-analytics-api)
- [Vercel: aggregates-page-views reference](https://vercel.com/docs/rest-api/web-analytics/aggregates-page-views) (the UTM dimensions)
- [Vercel: Pricing for Web Analytics](https://vercel.com/docs/analytics/limits-and-pricing) (UTM parameters are Plus and Enterprise only)
- [Vercel changelog: Public Web Analytics API now available](https://vercel.com/changelog/web-analytics-api)
- `docs/handoff/leo-lead-nurture-design.md` (27 August 2026), the six use cases and the posting-side ask
- `polynize-content-strategy-v0_2.md` (Marrs, internal), the six use cases as agent specs
- [LinkedIn Engineering: Engineering the next generation of LinkedIn's Feed](https://www.linkedin.com/blog/engineering/feed/engineering-the-next-generation-of-linkedins-feed), 12 March 2026
- [Instagram: Instagram Ranking Explained](https://about.instagram.com/blog/announcements/instagram-ranking-explained), 31 May 2023
- [TikTok Newsroom: How TikTok recommends videos #ForYou](https://newsroom.tiktok.com/en-us/how-tiktok-recommends-videos-for-you), June 2020
- [YouTube Blog: On YouTube's recommendation system](https://blog.youtube/inside-youtube/on-youtubes-recommendation-system/), 15 September 2021
- [YouTube Blog: How to convert YouTube Shorts views into long-form channel growth](https://blog.youtube/creator-and-artist-stories/youtube-related-videos-traffic-guide/), 14 July 2026
- [xAI: x-algorithm on GitHub](https://github.com/xai-org/x-algorithm), updated 14 August 2026
- [LinkedIn: Do links lower LinkedIn post reach](https://www.linkedin.com/top-content/marketing/linkedin-content-and-ads/do-links-lower-linkedin-post-reach/) (aggregated member opinion, not LinkedIn's voice)
- Trade summaries consulted and marked as secondary: SocialPilot, Hootsuite, Buffer, Dataslayer, OutlierKit, Socialync, VPNtoUS (TikTok region)
