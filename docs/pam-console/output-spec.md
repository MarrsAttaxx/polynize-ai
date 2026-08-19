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

## 5. Instagram carousel

| Property | Value | Source |
|---|---|---|
| Max slides **via a scheduler** | **10.** The API caps carousels at 10 items, and Metricool is an API client, so an 11-to-20 slide carousel can only be posted by hand | Official [Instagram content publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing); [Metricool](https://metricool.com/instagram-carousels/) confirms its own scheduler supports 10 |
| Max slides in-app | 20 (raised from 10 in Aug 2024) | [Social Media Today](https://www.socialmediatoday.com/news/instagram-expands-carousels-to-20-frames/723792/) |
| Our target | **10 slides.** It is the scheduler ceiling AND the best-performing count measured | See below |
| Best-performing count | 22M posts, ~3M carousels: **10 slides had the highest engagement, over 2% per post.** Engagement dips after slide 3 and climbs again from 8. Only 6% of carousels use all 10 | [YouGov](https://yougov.com/articles/31680-carousel-posts-using-all-10-slides-instagram-have-), [Socialinsider](https://www.socialinsider.io/blog/instagram-carousel/) |
| Caveat on that | The study predates the 20-slide limit, so 10 was the cap rather than a tested optimum. Nothing tests 11 to 20 | NO DATA |
| Dimensions | **1080 x 1350 (4:5)** | [Hootsuite](https://blog.hootsuite.com/social-media-image-sizes-guide/) |
| Critical rendering rule | **Every slide is cropped to the FIRST slide's dimensions.** Include any video and the whole carousel switches to portrait | [Buffer](https://buffer.com/resources/instagram-image-size/) |
| Carousel vs single image | Carousels beat single images on every metric, **9x more saves**. Single-image reach fell 21.96% year on year | [Metricool 2026 study](https://metricool.com/press-release-instagram-study-2026/), 24.4M posts |

## 6. Instagram single image and captions

| Property | Value | Source |
|---|---|---|
| Our render | **1080 x 1350 (4:5).** Valid under every source including the stricter API range, and the recommended format | Official [help](https://www.facebook.com/help/instagram/1631821640426723), [Buffer](https://buffer.com/resources/instagram-image-size/) |
| Is 4:5 or 1:1 favoured | **4:5, clearly.** No source checked favours 1:1 | Buffer |
| Ratio conflict worth knowing | The live help page says 1.91:1 to **3:4** (height up to 1440), the cached version and the Graph API say 1.91:1 to **4:5** (height to 1350). 1080 x 1350 is safe under both; 1080 x 1440 would be rejected or cropped by the API | Official, self-contradictory |
| Above 1080 wide | Downscaled to 1080. Unsupported ratios are cropped | Official help |
| Text on image | **Not penalised.** Meta retired the 20%-text rule and its checker. What is penalised is unoriginal content, not text density | [SEJ](https://www.searchenginejournal.com/facebook-removes-the-20-text-limit-on-ad-images/381844/), [Instagram originality guidelines](https://creators.instagram.com/original-content-guidelines) |
| Caption limit | 2,200 characters, 30 hashtags, 20 @ tags | Official [Graph API](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/) |
| Caption truncation | **~125 characters**, then "...more". Instagram publishes no official figure, but Meta's own ads guide recommends 125 characters of primary text, which matches | Third-party consensus + official ads guide |
| **Hashtags** | **Posts with hashtags saw 31.70% fewer views and 33.89% fewer interactions than platform average** | [Metricool 2026 study](https://metricool.com/press-release-instagram-study-2026/) |

**The 4:5 coincidence is a real efficiency.** 1080 x 1350 is simultaneously LinkedIn's tallest legal ratio and Instagram's recommended format. **One image render serves both platforms**, so the image playground only needs one primary size.

**Hashtags are off by default.** That is a direct reversal of common practice and it comes from a 24-million-post study.

## 7. Vertical video: Reels, and the safe area that governs every caption

| Property | Value | Source |
|---|---|---|
| Aspect ratio | 9:16 (accepted range 1.91:1 to 9:16) | Official [help](https://www.facebook.com/help/instagram/1038071743007909) |
| Minimum quality | **30 FPS and 720px** minimum resolution | Official help |
| Our render | 1080 x 1920 | API recommends 9:16, max 1920 horizontal px |
| The duration number that matters | **Reels over 3 minutes are not recommended to new audiences** | Official help |
| Duration conflict | In-app recording allows 20 minutes, the API and ads guide say 15 minutes, Metricool says 3. Only the 3-minute recommendation ceiling is consistent in effect | Official, self-contradictory |
| Optimal duration | NO DATA found. The nearest hard figure: **average watch time per Reel is 8.5 seconds**, more than double year on year | Metricool 2026 study |
| Cover | Recommended **420 x 654** (1:1.55). Sources conflict on whether it can be changed after posting | Official help; [Buffer](https://buffer.com/resources/instagram-image-size/) disagrees |
| Grid crop | Reels show at 1080 x 1920 in feed, **1080 x 1440 in the grid** | Hootsuite |

### THE SAFE AREA, and it is tighter than anyone assumes

Meta's own published figures: keep **at least 14% of the top, 35% of the bottom and 6% of each side** free of text, logos and key creative. ([Meta ads guide, Instagram Reels](https://www.facebook.com/business/ads-guide/update/video/instagram-reels))

On a 1080 x 1920 frame that is:

| Edge | Keep clear |
|---|---|
| Top | **269 px** |
| Bottom | **672 px** |
| Each side | **65 px** |
| **Usable band** | **950 x 979 px, vertically centred** |

Meta reports that Reels ads built 9:16, with audio, and key creative inside the safe zone had **34.5% lower cost per result** than image ads on Reels.

**This conflicts with our current caption practice, and the conflict is worth resolving before the next shoot.** Our house caption style is a lower-third around 50px from the bottom in Space Grotesk Medium. **A lower-third sits inside the bottom 672px that Meta says to keep clear.** Third-party guidance is looser (bottom 420px rather than 672px), so the truth is somewhere between, but our current position is inside the danger zone on either reading. Two honest options: lift captions to the vertical centre band, or accept that the bottom third is partially obscured by UI on Reels while remaining fine on a 16:9 YouTube cut. This is a decision, not a bug, and it needs Marrs's eye on a real phone.

## 8. YouTube Shorts

Verified against Google's own documentation, and it **corrects two things the third-party specs guides still get wrong.**

| Property | Value | Source |
|---|---|---|
| What makes it a Short | Square or vertical, **up to 3 minutes.** Use 16:9 to opt OUT of Shorts classification | Official [answer/15424877](https://support.google.com/youtube/answer/15424877) |
| Max duration | **3 minutes.** The 60-second figure everyone still quotes is obsolete | Official [answer/12779649](https://support.google.com/youtube/answer/12779649) |
| Resolution | Max **1080p** per YouTube Help. Conflict: Sprout lists up to 8K, and YouTube's own thumbnail spec is 2160 x 3840, so the 1080p line may be scoped to the in-app camera. Unresolved officially | Official [answer/10059070](https://support.google.com/youtube/answer/10059070) |
| Title | **100 characters** | Official [Data API](https://developers.google.com/youtube/v3/docs/videos) |
| Description | **5,000 BYTES, not characters.** Emoji and CJK eat 3 to 4 bytes each, so a 5,000-character description can fail | Official Data API |
| Hashtags | Over **60** and every hashtag is ignored. Three surface above the title | Official [answer/6390658](https://support.google.com/youtube/answer/6390658) |
| Music limit | Most songs usable for 90 seconds inside a 3-minute Short; some capped at 60 or 30 | Official answer/15424877 |
| Copyright trap | **Any Short over one minute with an active copyright claim is blocked globally** and cannot be monetised | Official answer/15424877, [answer/12504220](https://support.google.com/youtube/answer/12504220) |
| Custom thumbnail | **YES, since 24 July 2026.** YPP creators can upload one: 2160 x 3840, 9:16, JPG or PNG, under 50 MB, desktop Studio only, verified account. No A/B testing for Shorts | Official [YouTube blog, 24 July 2026](https://blog.youtube/news-and-events/youtube-studio-custom-thumbnail-updates/), [answer/72431](https://support.google.com/youtube/answer/72431) |

**Correction to what I wrote an hour ago.** I had "cannot upload a custom thumbnail for Shorts", sourced to a specs guide dated 4 August 2026. That guide is **stale**: the capability shipped 24 July 2026 and both Hootsuite and Buffer still say it does not exist. Any pipeline built off third-party specs guides silently skips a thumbnail step that is now available, which matters because our house rule is that the first frame IS the thumbnail.

### Shorts duration: the data is a mess, and the honest read

| Source | Says | Sample |
|---|---|---|
| [Metricool 2026](https://metricool.com/press-release-youtube-study-2026/) | Average view duration **collapsed ~67% to about 16 seconds** per Short, from ~48s a year earlier. Shorts views +127% YoY, and the Shorts feed is now **61% of all YouTube views** | 799,718 videos / 71,177 accounts |
| Inflow | 50 to 60 seconds wins on views | 5,400 Shorts, but dated **April 2023**, a 60-second-max era |
| OpusClip | 15 to 30 seconds wins on retention | **No sample size, no source cited** |

Inflow and OpusClip are directly opposed and neither is trustworthy for 2026. Metricool's 16 seconds is the largest and most current figure but it measures **actual watch time, not optimal length**, and conflating the two would be a mistake. **YouTube publishes no duration benchmark at all.** So: no target length from data. What we do know is that attention is collapsing and the feed now carries most of YouTube's views.

## 8b. TikTok

TikTok documents less than the other two, and its only real hard-spec source is its **Content Posting API** developer guide rather than any creator help page.

| Property | Value | Source |
|---|---|---|
| Aspect ratio | **TikTok publishes NO aspect-ratio requirement** for organic video. Its creative guidance says vertical 9:16, shoot at least 720p | Official [media transfer guide](https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide); [creative best practices](https://ads.tiktok.com/help/article/creative-best-practices?lang=en) |
| Resolution range | 360 px min, 4096 px max on both axes | Official media transfer guide |
| Our render | 1080 x 1920. **Third-party recommendation** (Hootsuite, Sprout), not a TikTok figure. Other dimensions get black bars | [Hootsuite](https://blog.hootsuite.com/social-media-image-sizes-guide/) |
| Frame rate | 23 to 60 FPS | Official media transfer guide |
| Max file size | 4 GB via API | Official media transfer guide |
| Max duration | **10 minutes documented.** All creators get 3 minutes, some get 5 or 10, and the API exposes a per-creator `max_video_post_duration_sec` a client must check | Official media transfer guide, [creator info reference](https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info) |
| Duration conflict | Metricool and most SEO blogs say 60 minutes. **No TikTok source supports 60 or 30 minutes.** 10 is the documented ceiling | Official docs vs [Metricool](https://metricool.com/tiktok-video-length/) |
| Caption limit | **2,200 UTF-16 runes** | Official [direct post reference](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post) |
| Caption conflict | The widespread 4,000 figure has **no TikTok source**, and Hootsuite contradicts itself across two of its own pages (2,200 in one tool, 4,000 in another) | |
| Caption truncation | **NO DATA** from TikTok. Third-party claims span 55 to 150 characters | |
| Cover | **Frame selection only.** Pick and drag a frame before posting. Custom image upload is not documented, and no size or format spec is published anywhere | Official [editing and posting](https://support.tiktok.com/en/using-tiktok/creating-videos/editing-posting-and-deleting) |
| Optimal duration | **21 to 34 seconds got a 280% conversion lift** over shorter or longer. 9:16 gave a 91% lift, 720p or better a 312% lift | Official [TikTok ads blog](https://ads.tiktok.com/business/en-US/blog/creative-that-drives-conversions), Dec 2021. **Ad data, and five years old**, but it is the most recent TikTok has published |
| Hook window | TikTok says **3 seconds** in one place and **6 seconds** in another, on the same help page. Over 63% of highest-CTR videos land the key message inside 3 seconds. Onscreen text in the first 7 seconds gave a 43% conversion lift in one vertical | Official creative best practices; ads blog |
| Text pacing | **5 to 10 words per second** when using onscreen text | Official creative best practices |

### The safe zone: TikTok publishes no numbers at all

Four separate TikTok ad-spec pages were checked. **Every one describes the safe zone qualitatively and then offers only a downloadable ZIP template.** The single numeric safe-zone value TikTok publishes anywhere is for a profile photo (key element inside the centre 66 x 66 px of a 98 x 98 px image).

Third-party bottom-inset claims for a 1080 x 1920 frame range from **250 px to 707 px**. One of those sources explicitly admits its numbers are internal production guidelines rather than TikTok spec. That spread is too wide to use, so **none of it is treated as spec here.**

**There is an authoritative route, and it needs a decision:** TikTok's own In-Feed Standard safe-zone ZIP template (84 KB) carries the real guides. Downloading it would settle the numbers. Say the word and it gets fetched.

### Originality, and the watermark rule that actually bites

TikTok's originality policy, last updated 24 December 2025, names four kinds of unoriginal content, and one of them is directly ours to avoid: **content carrying someone else's visible watermark or superimposed logo "in most cases does not count as original."** ([TikTok Creator Academy](https://www.tiktok.com/creator-academy/article/tiktok-originality-policy))

Consequences: removal from the For You feed, ineligibility for recommendation, and ineligibility for the Creator Rewards Program, which uses originality as a key metric. Creators can check status with TikTok's Account Check tool.

Note the precise scope: the policy names **someone else's** watermark. It does not say TikTok's own watermark on your own re-uploaded video is a violation. But since Instagram's rule is stricter and covers any visible watermark, our operating rule stands: **export a clean master and publish that file natively to each platform.**

### Format finding

**TikTok video takes 3.39% median engagement against 1.92% for TikTok photo carousels**, so video wins on TikTok while carousels win on Instagram ([Buffer](https://buffer.com/resources/data-best-content-format-social-media/), 45M+ posts). Instagram carousels get 4.7x the views of TikTok carousels, while Instagram Reels get 30% fewer views than TikTok videos (Metricool). The two platforms want different things from the same story.

## 8c. THE SAFE AREA THAT ACTUALLY GOVERNS OUR RENDERER

This is the single most build-critical number in the document, and my first pass got it wrong.

Google publishes its vertical safe area as a diagram, and the agent extracted the values from the SVG itself rather than trusting a blog: **top 288, bottom 672, left 48, right 192** on a 1080 x 1920 frame, giving 840 x 960. ([Google Ads Help answer/9128498](https://support.google.com/google-ads/answer/9128498)) Independently corroborated with the identical four numbers by [somake.ai](https://www.somake.ai/blog/youtube-shorts-aspect-ratio).

Meta's figures are 14% top, 35% bottom, 6% sides, so 269 / 672 / 65.

**I claimed designing to Meta's numbers would cover both platforms. That is false.** Google's right inset is **192px against Meta's 65px**, because the like/comment/share rail sits further into the frame. The true cross-platform envelope is the worst case on every edge:

| Edge | Meta (official) | Google (official) | TikTok | **Use this** |
|---|---|---|---|---|
| Top | 269 | 288 | no published figure | **288** |
| Bottom | 672 | 672 | no published figure | **672** |
| Left | 65 | 48 | no published figure | **65** |
| Right | 65 | **192** | no published figure | **192** |

**TikTok publishes no safe-zone numbers at all** (section 8b), and the third-party figures for it span 250 to 707 px on the bottom alone. Fortunately it does not matter for the envelope: Google binds the right edge at 192, and Meta and Google independently agree on 672 at the bottom, so the numbers above hold on Meta's and Google's own documentation without needing TikTok's. If TikTok's template later shows something tighter than 288/672/65/192 on any edge, the envelope shrinks to match.

**The renderer targets 823 x 960 px, offset 65 from the left and 288 from the top of a 1080 x 1920 frame.** Anything outside that can be covered by platform UI on at least one of the three.

Two caveats worth carrying: both Google and Meta describe these as **ad** guidance, which is more conservative than the organic player because CTA buttons sit lower, and Google notes the bottom margin grows on devices with a Dynamic Island. Neither publishes an organic per-element breakdown. So this is the safe envelope, not the only workable one.

**And it still conflicts with our caption practice.** Our lower-third at roughly 50px from the bottom is deep inside the 672px both companies say to keep clear. That decision is unchanged and still needs Marrs's eye on a real phone.

## 9. Cross-posting one video to three platforms

| Rule | Detail | Source |
|---|---|---|
| **Watermarks are the real risk** | Eligible content must have "no visible watermarks". Accounts posting 10+ reposts in 30 days lose recommendation eligibility | Official [Instagram](https://creators.instagram.com/blog/recommendations-and-originality) |
| What counts as unoriginal | Content "copied without material edits". Borders, watermarks, speed changes and crediting the original do **not** count as material edits. Eligibility recovers on a 30-day rolling basis | Official [originality guidelines](https://creators.instagram.com/original-content-guidelines) |
| Editing elsewhere is fine | Mosseri: creating or editing a Reel in another app does not reduce reach. **Your own logo is fine.** Instagram tries not to recommend Reels carrying other apps' logos | [Social Media Today](https://www.socialmediatoday.com/news/instagram-clarifies-including-your-own-logo-on-a-reel-is-ok/730852/) |
| Quantified reach loss from identical cross-posts | NO DATA. Figures like "40 to 60% more reach when you adapt per platform" appear only in SEO content with no dataset behind them and are not reported here | |

**The fully sourced operating rule:** export one clean master with no platform watermark, publish that same file natively to each platform, and vary the caption and cover per platform. Our pipeline already does this, because the edit happens in Final Cut and Descript rather than in a platform app.

---

## 10. What this means for the build

**Gate 3's kit stops being counts and becomes typed outputs.** Each tick names a real end state from this document: a LinkedIn text post of a chosen TYPE with a 4:5 image, a document carousel of 7 to 12 self-contained slides, the Pulse article, the cutdown text post, and so on.

**Every LinkedIn post carries an image**, per Marrs's instinct and the data behind it. The image comes from the existing Higgsfield generation plus the deterministic text overlay already in the media library.

**Carousels are generated, not extracted.** April writes the slide narrative first, then per-slide image prompts, then the images are generated and text is overlaid, then composed to PDF.

**The link always goes in the first comment.** Our Metricool client already supports `firstCommentText`, so this is a wiring detail, not a build.

**One image size does most of the work.** 1080 x 1350 (4:5) is LinkedIn's tallest legal ratio and Instagram's recommended format at the same time, so the playground renders one primary size for both.

**Instagram carousels are capped at 10 slides for us,** because that is the API ceiling and Metricool is an API client. It also happens to be the best-performing count measured. All slides must be generated at the same dimensions, since the first slide's size crops the rest.

**The caption and hook renderer targets 823 x 960 px, offset 65 from the left and 288 from the top** of a 1080 x 1920 frame. That is the worst case across Meta, Google and TikTok. Meta's numbers alone are NOT sufficient: Google's right-hand inset is 192px against Meta's 65px, because the Shorts icon rail reaches further in. See section 8c.

**Hashtags are off by default on Instagram,** against common practice, on the strength of a 24-million-post study showing a 31.70% view penalty.

**Blocked, needs the spike:** whether Metricool can schedule a LinkedIn document post at all, and how we produce the PDF.

**Needs Marrs on a phone:** the caption position conflict in section 7. Our lower-third sits inside the region Meta says to keep clear.

**Shorts now take a custom thumbnail** (since 24 July 2026, YPP only, desktop Studio only, 2160 x 3840). Our house rule already makes the first frame the thumbnail, so the pipeline should export that frame at 2160 x 3840 and upload it rather than letting YouTube pick.

**Watch the one-minute copyright line on Shorts:** over 60 seconds with any active claim and the Short is blocked globally, so licensed music in a long Short is a hard fail rather than a warning.

**Still unverified:** TikTok publishes no safe-zone numbers at all. Its own ZIP template is the authoritative route and needs one decision to fetch. Those need either a second research pass or a look at each platform's own creator docs.
