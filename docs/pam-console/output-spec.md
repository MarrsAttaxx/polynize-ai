# The output spec: what every finished post actually is

**v0.1 · 19 August 2026 · The "end in mind" document.** Marrs: *"we need to always think with the end in mind: thinking of what the post looks like and what we are actually trying to achieve at the end... then try and fit the long-form piece of content, create all the bits that we need to tick off all the lists, and then compose the end state."*

This is that list. It defines the END STATE of every post type, so Gate 3's kit becomes a real menu and each Gate 4 flow is built to produce exactly one of these.

**Sourcing rule.** Every number here carries a source. Where platform docs and studies disagree, both are shown, because a single confident number would be a lie. Where nothing credible exists it says NO DATA rather than filling the gap. **Sandcastles was not reachable when this was written**, so there is no live hook or format performance data from our own watchlist in here.

---

## 0. The finding that changes the build

**LinkedIn retired the native image carousel for organic posts in December 2023.** The only swipeable carousel on LinkedIn in 2026 is a multi-page **document post** (PDF, PPTX or DOCX). A multi-image post renders as a grid, not a swipe. ([SocialBee](https://socialbee.com/blog/how-to-post-linkedin-carousels/), [Social Media Today](https://www.socialmediatoday.com/news/linkedin-launches-native-carousel-posting-option/627881/))

Three consequences, all of them ours to solve:

1. Our kit item "LinkedIn Carousel" must produce a **PDF**, not a set of images.
2. **The console has no PDF generation at all.** No library, no dependency. The existing pattern here is browser print (the SOW page), and media is hosted as Box links.
3. **Our Metricool client only ever sends `media[]`.** It never sends the `linkedinData.type` field their API documents. Whether Metricool can schedule a LinkedIn document post at all is UNVERIFIED and is now the top question in the Step 0 spike.

Until that is settled, a LinkedIn carousel is composable in the console but not schedulable from it.

---

## 1. LinkedIn text post

### The end state

| Property | Value | Source |
|---|---|---|
| Hard character limit | **3,000** | Official [a528176](https://www.linkedin.com/help/linkedin/answer/a528176) |
| The hook window | **First 140 characters.** That is what survives the "see more" fold on every device (desktop is ~210, mobile ~140, and line breaks count, so many short lines truncate even earlier) | Third-party consensus only, no official figure: [AuthoredUp](https://authoredup.com/blog/linkedin-character-limit) |
| Target length | **1,300 to 2,500 characters.** That is the overlap of the two largest studies | [AuthoredUp](https://authoredup.com/blog/linkedin-character-limit) 372k posts: 1,301-2,500 peaks at 2.61-2.67% ER. [Taplio](https://taplio.com/blog/how-long-should-a-linkedin-post-be): monotonic to 2,000+ at 2.56% |
| Floor | **Never under ~400 characters.** The only length claim all three studies agree on | AuthoredUp, Taplio, van der Blom |
| Image | **Yes, always.** Image plus 2,000+ characters is the single best combination measured, 2.77% vs 1.98% for text-only | [Taplio](https://taplio.com/blog/how-long-should-a-linkedin-post-be) |
| Link | **Never in the body.** One external link cuts median reach 18.8%, and you cannot have both a link preview and an image in one post. Links go in the first comment | van der Blom; official [a525309](https://www.linkedin.com/help/linkedin/answer/a525309) |
| Close | **End on a question.** Posts including one get 77% more comments, and comments are the ranking signal LinkedIn's own team names | [Metricool](https://metricool.com/linkedin-trends-study/) 673k posts; [Buffer interviews with LinkedIn's content team](https://buffer.com/resources/linkedin-algorithm/) |

Two studies disagree on whether maxing the 3,000 limit hurts (AuthoredUp says yes, Taplio says no) and van der Blom puts the sweet spot far lower at 800-1,000. The 1,300-2,500 band is the honest intersection, not a consensus.

### The post types, ranked on real data

From [MagicPost](https://magicpost.in/blog/linkedin-post-types-engagement): 1,141,932 posts, trailing 12 months to 5 June 2026, personal profiles only, median engagement rate as (likes + comments) / followers. Classifier-assigned, so treat the ranking as directional and the absolute percentages as not comparable to any other study here.

| Type | ER | Comments | What it is |
|---|---|---|---|
| Celebrating a win | 1.21% | 11 | A result, named, with the work behind it |
| Challenges overcome | 1.03% | 14 | The obstacle and how it broke |
| Hard moment | 0.80% | **16** | A cost paid, told straight |
| Lessons learned | 0.70% | 8 | What the experience taught |
| Situation recap | 0.68% | 9 | A thing that happened, narrated |
| Field report | 0.63% | 8 | What you saw out in the market |
| Tips / listicle | 0.49% | **23** | Numbered rules, highest comments in the whole set |
| **Contrarian take** | 0.49% | 14 | The belief, then the break |
| **Explainer / analysis** | 0.40% | 4 | Teaching the mechanism |
| Value-first selling | 0.33% | 11 | Bottom of the table |
| Webinar / podcast push | 0.29-0.31% | 6-7 | The worst thing you can post |

**The strategic read, and it cuts against instinct.** The top of that table is first-person narrative with stakes. Pure teaching (explainer, best practices, quick tip) sits mid-to-low, and promotion sits at the bottom. Corroborated independently by a peer-reviewed study of 1,001 users' posts: business and expertise posts were the most FREQUENT, but interpersonal and observational posts drew significantly more comments and reactions ([Usera, Cox and Walker, SAGE Open, March 2026](https://mavmatrix.uta.edu/marketing_facpubs/3)).

But note where the comments are: **listicle (23) and contrarian (14) produce the highest comment counts in the set** despite mid-table engagement rate. Since comments are the distribution signal, contrarian and listicle are reach plays even when their ER looks ordinary.

**This maps onto the lanes almost exactly.** Marrs lane can use the whole top of the table, because it is opinion in his own voice with his own stakes. Polynize lane is structurally stuck in the 0.40-0.49% band, because educational explainer is what it is for. That is not a reason to stop doing it, it is a reason not to judge the two lanes by the same number.

**No data found:** typical length per narrative type. MagicPost states it publishes none. Anything specific here would be invented.

### Image spec

| Property | Value | Source |
|---|---|---|
| Recommended width | **1080 px** | Official [a525309](https://www.linkedin.com/help/linkedin/answer/a525309) |
| Allowed aspect ratios | **3:1 to 4:5** | Official a525309 |
| Our default | **1080 x 1350 (4:5)**, the tallest legal ratio, so maximum mobile feed height | Practitioner recommendation only; LinkedIn publishes nothing beyond "1080 wide" |
| Max file size | 5 MB | Official a525309 |
| Minimum | 552 x 276 | Official a525309 |
| Multi-image | Up to 20, rendered capped at 4:5. **A grid, not a swipe** | Official a525309 |

The commonly quoted 1200 x 627 is LinkedIn **ad** guidance, not organic. Do not use it.

---

## 2. LinkedIn document carousel

### The end state

| Property | Value | Source |
|---|---|---|
| File | **One PDF per post.** PPT, PPTX, DOC, DOCX also accepted | Official [a518909](https://www.linkedin.com/help/linkedin/answer/a518909), [a523054](https://www.linkedin.com/help/linkedin/answer/a523054) |
| Max size / pages | 100 MB, 300 pages | Official a518909 |
| Page size | **Every page must be the same size.** Mixed sizes must be fitted to one | Official a518909 |
| Slide count target | **7 to 12** | Loose practitioner consensus ([Oktopost](https://www.oktopost.com/blog/linkedin-carousel-pdf-best-practices/) 5-15, [Metricool](https://metricool.com/linkedin-carousel/) 7-15). **No completion-rate data exists behind any of these numbers** |
| Dimensions | 1080 x 1350 (4:5) or 1080 x 1080 (1:1) | Third-party only. LinkedIn publishes organic document dimensions nowhere; its only page-size guidance is in ad docs |
| Text per slide | **Under 60 words**, 6 to 8 lines max | Oktopost |
| Minimum font | **24 pt.** Under 20 pt is unreadable on mobile without zoom | Oktopost |
| Safe margin | 50 px from every edge | Oktopost |
| Animation | Becomes a static image | Official a518909 |
| Links inside the PDF | **Unreliable to dead**, especially in the mobile app. The CTA and the link belong in the post caption | Sources conflict on desktop; none claim mobile works |

### Why self-contained is a platform constraint, not a preference

Marrs: *"the carousel needs to be self-contained in the sense that each slide needs to explain exactly what's going on."* The platform agrees and enforces it: animations flatten to stills, and you cannot reliably route a reader out of a slide. A slide has to land on its own or it does not land.

This is also why **a prezie frame is the wrong source.** The prezie is a simplified interface he narrates over; its slides depend on the voiceover to mean anything. A carousel has no voiceover.

### Slide by slide

| Slide | Job |
|---|---|
| **Cover** | Stop the scroll in two seconds. One specific claim or number, high contrast, a visible swipe cue. Generic titles are the named failure mode |
| **Body** | One idea per slide. Each slide must deliver concrete value or create curiosity; a slide doing neither gets cut. Alternate text-led and visual-led. Number the slides |
| **Close** | The takeaway in one sentence, one CTA, brand mark. A question here drives the comments |

Caption: 100 to 200 words, hook inside the first 140 characters, link in the first comment.

---

## 3. LinkedIn article (Pulse)

| Property | Value | Source |
|---|---|---|
| Body limit | **125,000 characters** | Official [a522483](https://www.linkedin.com/help/linkedin/answer/a522483). This retires the widely repeated 110,000 figure |
| SEO meta title | Truncates over 60 chars; description 140-160 | Official [a6244140](https://www.linkedin.com/help/linkedin/answer/a6244140) |
| Reach vs a text post | **Worse. 0.69x reach, 0.44x engagement** (596 median reach vs 921 for a text post, 1,198 for a document) | [AuthoredUp](https://authoredup.com/blog/linkedin-articles-vs-posts) 372k posts |
| Durability | **Reach fell only 6% year on year**, against 36% for video and 16% for images. Gets its own Google-indexable URL and a permanent profile slot | AuthoredUp; official a6244140 |

**LinkedIn's own docs draw no distributional distinction between posts and articles** ([a516930](https://www.linkedin.com/help/linkedin/answer/a516930)). The widespread claim that articles are algorithmically suppressed has no official source. The measured underperformance is real, but the honest framing is that an article is a **durability and search play, not a reach play.**

**The actual unlock is a newsletter.** Up to 5 at a time; the first published article invites every connection and follower to subscribe; subscribers are notified on **every edition**, and it also appears in the feed ([a517925](https://www.linkedin.com/help/linkedin/answer/a517925)). That is a distribution channel we are not using at all, and it is worth its own decision.

**Our article master should therefore be:** published as the long-form Pulse article for durability and search, AND cut down to a 1,300 to 2,500 character text post with an image for reach. Those are two different posts from one article, not one.

---

## 4. Cadence and operational levers

Not format spec, but these change what the console should prompt him to do.

| Lever | Effect | Source |
|---|---|---|
| 4 to 5 posts per week | 2.60% ER and **28% more impressions per post** than posting once a week. Only 4.45% of profiles manage it | [AuthoredUp](https://authoredup.com/blog/best-performing-content-on-linkedin) |
| Replying to your own comments | **+30% engagement**, and 83% of profiles improved. LinkedIn is the highest of any platform Buffer measured | [Buffer](https://buffer.com/resources/state-of-social-media-engagement-2026/) |
| Replying within 30 minutes | **64% more comments, 2.3x views** | van der Blom |
| The first 60 to 90 minutes | Sets reach. ~40% of all interactions happen on day one | Metricool; van der Blom |
| Documents are underused | Best reach multiplier on the platform, posted by only **4.88%** of creators | AuthoredUp |
| Personal profile vs company page | **63% higher engagement** at similar impressions | [Metricool](https://metricool.com/press-release-linkedin-study-2026/) |
| Reshares | **0.29x reach.** The worst thing you can post | AuthoredUp |
| LinkedIn video | Median reach **down 36% year on year** | AuthoredUp, corroborated by Socialinsider |

Two of these have direct console consequences. The 2-a-day cadence target is well above the 4-to-5-a-week evidence sweet spot, so **posting twice a day on LinkedIn specifically may be past the point of return** and is worth testing rather than assuming. And the 30-minute reply window is an operational prompt the console could surface after a post goes live, which is a Learn-loop feature rather than a Create one.

### One claim I chased down and rejected

The "single images get 30% less reach than text-only in 2026" line currently circulating **has no traceable dataset**. The page most cited for it contains no numbers at all and explicitly disclaims having them. Four independent studies point the other way. Treated as unsourced and ignored here.

---

## 5. Instagram, TikTok and YouTube Shorts

*Pending: the second research pass. This section will carry aspect ratios, durations, caption limits, carousel slide counts and the per-platform SAFE AREAS that hook text and captions must avoid.*

---

## 6. What this means for the build

**Gate 3's kit stops being counts and becomes typed outputs.** Each tick names a real end state from this document: a LinkedIn text post of a chosen TYPE with a 4:5 image, a document carousel of 7 to 12 self-contained slides, the Pulse article, the cutdown text post, and so on.

**Every LinkedIn post carries an image**, per Marrs's instinct and the data behind it. The image comes from the existing Higgsfield generation plus the deterministic text overlay already in the media library.

**Carousels are generated, not extracted.** April writes the slide narrative first, then per-slide image prompts, then the images are generated and text is overlaid, then composed to PDF.

**The link always goes in the first comment.** Our Metricool client already supports `firstCommentText`, so this is a wiring detail, not a build.

**Blocked, needs the spike:** whether Metricool can schedule a LinkedIn document post at all, and how we produce the PDF.
