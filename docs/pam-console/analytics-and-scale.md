# Analytics, attribution and scale: the deep dive

**Written 3 September 2026, for Marrs.** The brief for the next phase: turning Metricool's numbers and polynize.ai's traffic into decisions about what to post more of, across more brands, to drive more people into the lead magnets and on to discovery calls, trials, proposals and delivery.

Two inputs: a research note from another agent on Metricool autolists, and Marrs's own framing, which takes precedence. Everything below was checked against Metricool's OpenAPI spec (1.2MB, downloaded), Metricool's own help centre, Vercel's Web Analytics API documentation, and this codebase. Where a claim could not be verified it is marked as such.

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
- **which Story and which lane it serves**;
- **its slot kind** (LinkedIn morning is video, afternoon is stills);
- **whether it is hand-posted** (Marrs's own LinkedIn never touches Metricool);
- **its timezone**, stamped rather than re-derived.

The frame ladder, the tile the whole learning loop depends on, is "which post type earns the most reach within one voice." Metricool cannot answer that because it does not know our frames. An autolist is a FIFO with a timetable; feed it and the frame identity is gone at the door unless we keep our own record of what went in, which is exactly what the calendar entry is.

### Autolists are for the evergreen tier, and that is the "double down" mechanism

Marrs: *"If we find one type of content that's working, we create a channel specifically for that content and double down."*

That is what `Repeat` is for. A proven post goes into a circular list on off-peak slots and recycles. The console decides what is proven (from the numbers in section 3), writes it to the list via `/lists/posts/add`, and records the autolist item id on the entry so the recycled post still joins back to its frame and lane. Fresh content drains through our queue; winners circulate through theirs. The fair use rule about repetitive identical content means recycled copy should vary between cycles, which April can do.

**To build:** an autolist client (list, add, timing), a "promote to evergreen" action on a post, and the item id stored on the entry. Not before section 3 exists, because "proven" needs a number.

---

## 3. Click-through: the honest answer, and the gap that makes it zero today

### The gap first

**The auto path publishes no link to polynize.ai at all.** The kit declares `link: 'first_comment'` on every LinkedIn text frame (a link in the body costs about 18.8% of median reach), the calendar entry has a `first_comment` field for it, and Metricool's client sends `firstCommentText`. **Nothing ever writes `first_comment`.** Not the wave, not prepare. The kit's link rule exists as a lint that refuses a link in the body and as an instruction to April not to write one. So a LinkedIn post ships with no link anywhere. Click-through is zero by construction, not by audience behaviour.

**And the site discards attribution at the door.** The nurture design brief (27 August) found it and asked the posting side to set `utm_campaign` per lane. The site side has not captured UTMs yet: `/map-your-team` reads only `?start=1`, the `sessions` insert stores `{ id, phase }` and nothing about arrival, and the `leads` row has `source: 'blueprint'` and nothing else. **Both halves of the join are missing.** That is good news in one way: nothing has to be undone.

### Three sources of click data, ranked

**1. First-party, ours.** polynize.ai is our Next.js app. Capture `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` and the referrer on the first request into a funnel, persist them on the session, write them to the lead when the magnet completes. This needs no plan, no vendor, no export, and it is the only source that can follow a click **through** the funnel: landing, magnet started, magnet completed, email captured, blueprint opened, booking clicked. The nurture brief already specified the `leads` columns (`utm jsonb`, `lane`, `lane_confidence`). **This is the join, and it is under our control.**

**2. Vercel Web Analytics API.** Real and now public: `GET /v1/query/web-analytics/visits/aggregate` grouped by `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`, `referrerHostname`, `route`, and custom events by `eventData/<prop>`. Filters are OData. **Gated by plan:** UTM parameters are collected only on **Pro with Web Analytics Plus** ($10/month add-on) or Enterprise; custom events need Pro; the reporting window is 1 month on Hobby, 12 on Pro, 24 on Plus. The site's own `track()` comment notes that custom events silently drop on Hobby. **Which plan the team is on decides whether this source exists at all.** Question for Marrs. Even on Plus this source is a cross-check on source 1, not a replacement, because it cannot see magnet completion or the lead.

**3. Metricool, LinkedIn only.** `LinkedinPost.clicks` is a real field their per-network analytics return, and we already pull LinkedIn. It is the platform's own click count and it joins to our entry by url (D84's second read). Useful as a LinkedIn-only reach-to-click ratio. Nothing equivalent exists for the other three networks in their API.

### The link, and the key inside it

Every link the console publishes should be built by one function, never by hand:

```
https://polynize.ai/<magnet>?utm_source=<network>&utm_medium=social
  &utm_campaign=<lane>&utm_content=<entry_id>
```

- `utm_campaign = lane` is what the nurture brief asked for: it resolves which of the six segments a lead belongs to, which the magnet alone cannot (four lanes share one magnet).
- `utm_content = entry_id` is the exact join back to the calendar entry, and through it to the frame, the Story, the stream and the slot. **One id, and every question in Marrs's list becomes a query:** which posts drove clicks, which frames drove completions, which network converts.
- The link goes where the kit already says it goes: first comment on LinkedIn, caption plus first comment on a document, the post url itself for an article.

Metricool's shortener would rewrite the link to `t.mtrbio.com/...` and, by their own statement, record nothing. **Turn the shortener off** on our brands so the UTM survives to our server.

---

## 4. The funnel we can measure end to end

| Stage | Where it is recorded | Exists today |
|---|---|---|
| Post published | Calendar entry, with frame, lane, stream, slot | Yes |
| Reach and engagement | Metricool per-post analytics, joined by url after publication | Pull exists (D86); the url join is the next commit |
| Click | First-party landing capture with `utm_content = entry_id` | **No** |
| Magnet started | `sessions` row; needs the attribution stamped on insert | Row yes, stamp no |
| Magnet completed, email captured | `leads` row; needs `utm` and `lane` | Row yes, columns no (specified in the nurture brief) |
| Blueprint opened, forwarded | Not tracked; the nurture brief calls this the single strongest buying signal and it is invisible | **No** |
| Discovery call booked | `booking_click` event fires; the booking itself happens on Calendly | Click yes, booking no (Calendly webhooks would close it) |
| Trial, proposal, paid | CRM | Out of scope here |

The first four rows are the marketing engine's own loop and every one of them is buildable now. Once the click and the lead carry `entry_id`, the frame ladder stops ranking by impressions and starts ranking by **magnet completions per post**, which is the metric that actually tracks his goal.

---

## 5. Scale: brands, lanes and the data model

Marrs: *"We can create more brands in Metricool and more channels to create more surface area... we're only using five or fifteen brands in Metricool at the moment."*

### What the model has and what it lacks

The console has **streams** (who the content is for) and Metricool has **brands** (accounts), mapped one to one. It has **frames** (what kind of post). It does not have **lanes** (which use case a post serves), and the nurture design defines six of them with Kit segments: `ai_capability_lead`, `sales_lead`, `ld_lead`, `hiring_manager`, `security_lead`, `deal_side`.

**Lane is the missing axis, and it is the one his strategy is organised around.** A Story is about something; that something is a lane. Add `lane` to the Story (chosen at Gate 1, defaulted by April from the idea), carried to every piece and every entry, written into every link as `utm_campaign`. Then:

- the frame ladder can be read **per lane**, which is the question "what works for hiring managers" rather than "what works";
- a lane whose numbers justify it gets its own Metricool brand, which is his "create a channel specifically for that content";
- the nurture side gets its segment for free, from the link.

### Brands as a scaling unit

More brands is more surface area, and it is cheap on the console side: a brand is a stream mapping and a schedule. The constraint is content per surface: the platforms reward accounts that post consistently at a sustainable rate, and each brand needs its own voice doc or the lane's. The kit already produces 16 posts per Story; the question becomes how many Stories per lane per week the team can approve, not how many posts the system can make. **Approval is the bottleneck, so the analytics should point approval at the frames and lanes that convert.**

**Fair use** is 600 posts per brand per month. At 16 posts per Story that is 37 Stories a month on one brand before Metricool looks. Not a constraint at any realistic approval rate.

---

## 6. The build order

Each step unlocks the next, and each is small enough to ship and check.

1. **Links with the key.** One function builds every outbound link with the four UTMs; `first_comment` is populated at prepare and by the wave from the kit's placement rule; the Metricool shortener is off. *Unlocks: any click can be attributed at all.* Small.
2. **First-party capture on polynize.ai.** Middleware or the first-touch pages read UTMs and referrer, stamp them on the session insert, write them to the lead on completion, per the nurture brief's columns. *Unlocks: source 1, and the lane for nurture.* Small, but it is public-site code and the nurture brief marks it as that session's to build; coordinate rather than collide.
3. **The url join.** The second read after publication (`GET /v2/scheduler/posts` carries `providers[].publicUrl`, proven in D84) stores the platform url on the entry; analytics rows join on it. *Unlocks: real per-post reach against our frames, and D85's "posted" becomes confirmed.* Small.
4. **Lane on the Story.** One field, defaulted by April, carried down, written into the link. *Unlocks: everything per use case.* Small in code; a decision about the six lanes in product.
5. **The frame ladder, by lane, by conversion.** Post type ranked by magnet completions per post within one voice and one lane, with `n` per row and rows under `n = 3` faded because a frame with two posts behind it is a rumour. *Unlocks: the decision "make more of these".* Medium.
6. **Evergreen autolists.** Promote a proven post to a circular list per network, item id stored on the entry, copy varied per cycle. *Unlocks: the double-down.* Medium.
7. **The nightly pull**, once the button is boring. Small.

Steps 1 to 3 are a week of work and they turn the analytics panel from "how much reach" into "how many leads, from which posts." Step 5 is the one that changes what gets approved.

---

## 7. Questions only Marrs can answer

1. **Which Vercel plan is the team on?** Hobby, Pro, or Pro with Web Analytics Plus. It decides whether source 2 exists and whether the site's custom events are being recorded at all right now.
2. **Where is the audience?** Australia, US, or global. It decides every posting time.
3. **Which lanes go hard first?** The nurture brief says the strategy marks three "go hard" and two "light". The console should build for those three and not model six equally.
4. **The marketing plan document.** The new thinking around use cases is referenced but the console only has the nurture brief's summary of the six lanes. The source document would let the lane model match it exactly rather than approximately.
5. **TikTok business account**, which he has already committed to.
6. **The Metricool shortener**: confirm it is acceptable to turn off, since it is the only thing that would strip our UTMs.

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
- `docs/handoff/leo-lead-nurture-design.md` (27 August 2026), the six lanes and the posting-side ask
