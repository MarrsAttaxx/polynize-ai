import type { Network, SlotKind, SlotPrefers } from './channel-schedule';
import type { NarrativeLane } from './narrative-store';
import { streamKind, STREAM_IDS, type StreamKind } from './streams';
import { safeRect, type SafeRect } from './safe-area';

/**
 * THE KIT (v2): what one Narrative produces, as TYPED OUTPUTS rather than counts.
 *
 * v1 said "4 posts, one per beat". It could not say what post 2 WAS, so every post came out
 * of one piece carrying one body, and four calendar entries shipped the same text. Marrs asked
 * the question that kills that model: "Is it a contrarian post? Is it an informative post?"
 * A count cannot answer it. So each entry here names a real END STATE from
 * docs/pam-console/output-spec.md, and the frame reaches April as a different instruction.
 *
 * FOUR RULES THIS FILE ENFORCES, each one a thing that was wrong before:
 *
 * 1. ONE OUTPUT, ONE PIECE, for anything with its own words. Three LinkedIn frames are three
 *    MasterAssets, so each gets its own piece with its own body and its own image, and Gate 5's
 *    existing `missing = count - have` guard is already exact because every count is 1. The
 *    alternative (three outputs sharing one master) silently collapses to one piece and
 *    publishes the same post three times under three different labels.
 * 2. EVERY POST CARRIES AN IMAGE. `visual` is required on every artifact with no optional
 *    escape, so an output that forgets one does not compile. Marrs: "every post, even the
 *    article, has to go out with an image."
 * 3. SOURCE STRENGTH IS PART OF THE DATA. Every number is wrapped in `Sourced`, because a
 *    figure with no provenance reads identically whether it came from LinkedIn's API reference
 *    or an SEO blog. Where the output spec says NO DATA there is NO FIELD, and `doNotAssert`
 *    carries the gap forward as an instruction so the model cannot fill it either.
 * 4. THE SPEC REACHES THE WRITER. `promptFragment` is read by draft.ts. Without that, a screen
 *    naming three frames drafts three of the same post and the labels are decoration. This was
 *    the condition every reviewer put on the design, and it is not optional.
 *
 * PURE AND CLIENT-SAFE. NarrativeGates.tsx is a client component, so a VALUE import of a store
 * would drag server-only code into the browser bundle. The two store imports here are
 * type-only and erase at compile; ./safe-area is a value import and has no imports of its own.
 */

/* ------------------------------------------------------------------ provenance */

export type Strength =
  /** The platform's own documentation. */
  | 'official'
  /** A named dataset with a stated sample size. */
  | 'large_study'
  /** A loose consensus among tools and agencies, with no dataset behind it. */
  | 'practitioner'
  /** The platform's own ADVERTISING guidance, borrowed for organic. Weaker than it looks. */
  | 'ad_data'
  /** Our own measurement, or a house rule of Marrs's. */
  | 'ours';

/** A number and how much weight it can carry. A missing figure is an absent field, never a 0. */
export type Sourced<T> = { v: T; src: Strength; note?: string };

/* ------------------------------------------------------------------ what a post is */

/** The FRAME the post takes, which is the thing v1's counts could not express. */
export type PostType =
  | 'pulse_article'
  | 'contrarian'
  | 'hard_moment'
  | 'listicle'
  | 'field_report'
  | 'explainer'
  | 'document'
  | 'swipe'
  | 'card'
  | 'vertical_video'
  | 'wide_video';

/**
 * THE AUTHORING UNIT, persisted on `piece.master` and the key both the build route and the
 * wave route index a narrative's pieces by.
 *
 * The six v1 values are FROZEN: they are already on saved pieces and nothing may rename or
 * remove one. Three members are ADDED for the extra LinkedIn text frames, and 'texts' now
 * means the CONTRARIAN frame specifically, which is why a v1 narrative's existing text piece is
 * adopted rather than orphaned when its kit is re-confirmed.
 *
 * A text frame gets its own member rather than sharing one because `master` is used as a
 * unique key per narrative (build/route.ts, wave/route.ts). Two outputs on one master collapse to
 * one piece, last write wins, and the loser keeps its draft while being invisible and never
 * planned onto the calendar.
 */
export type MasterAsset =
  | 'article'
  | 'texts'
  | 'texts_hard'
  | 'texts_list'
  | 'texts_field'
  | 'shorts'
  | 'long'
  | 'carousel'
  | 'images';

/**
 * THE IMAGE, required everywhere. For video this is the frame the cover is cut from, since the
 * house rule is that the first frame IS the cover; the per-network cover FILE lives on the
 * wrapper, because that is the part that differs between platforms.
 */
export type VisualSpec = {
  /** One phrase, written to feed a generation prompt rather than to be read on screen. */
  what: string;
  w: number;
  h: number;
  /** How many images. 1 for a card, 10 for a swipe carousel. */
  images: number;
  src: Strength;
  note?: string;
};

export type ArtifactSpec =
  | {
      kind: 'text';
      /** The platform's hard stop. */
      cap: Sourced<{ n: number; unit: CountUnit }>;
      target: Sourced<[number, number]>;
      floor: Sourced<number>;
      /** Characters before the feed truncates with a "see more". */
      fold?: Sourced<number>;
      visual: VisualSpec;
    }
  | {
      kind: 'longform_text';
      cap: Sourced<{ n: number; unit: CountUnit }>;
      metaTitle: Sourced<number>;
      metaDescription: Sourced<[number, number]>;
      visual: VisualSpec;
    }
  | {
      kind: 'pdf';
      pages: Sourced<[number, number]>;
      marginPx: Sourced<number>;
      minFontPt: Sourced<number>;
      maxWordsPerPage: Sourced<number>;
      visual: VisualSpec;
    }
  | { kind: 'image_set'; visual: VisualSpec }
  | {
      kind: 'video';
      frame: { w: number; h: number; src: Strength; note?: string };
      minFps?: Sourced<number>;
      /**
       * Read from ./safe-area, never restated. Absent for wide video: the output spec gives
       * 16:9 no end state at all, and a hand-written SafeRect would be a second source.
       *
       * THERE IS NO TARGET-DURATION FIELD ANYWHERE IN THIS FILE, on purpose. Not one of the
       * three platforms publishes an optimal length. The figures that circulate are either
       * watch time (8.5s on Reels, ~16s on Shorts), five-year-old ad conversion data
       * (TikTok's 21 to 34 seconds), or directly contradictory (50 to 60s against 15 to 30s).
       * A field would invite one of them to become an instruction.
       */
      safeArea?: SafeRect;
      visual: VisualSpec;
    };

/** Character counting is not one thing. Bytes and UTF-16 runes are NOT characters. */
export type CountUnit = 'char' | 'rune' | 'byte';

export type LinkPlacement =
  /** LinkedIn feed. One link in the body costs 18.8% median reach (van der Blom). */
  | 'first_comment'
  /** LinkedIn documents: the CTA goes in the caption, the link also in the first comment. */
  | 'caption_and_first_comment'
  /** The post IS the destination url. */
  | 'is_the_url'
  /** The output spec states no rule for this network. Do not invent one. */
  | 'unspecified';

export type CoverSpec =
  | { how: 'upload'; w: number; h: number; src: Strength; note?: string }
  | { how: 'pick_frame'; src: Strength; note?: string }
  | { how: 'none' };

/** How the artifact reaches ONE platform. This is the part that cannot be authored once. */
export type WrapperSpec = {
  captionMax?: Sourced<{ n: number; unit: CountUnit }>;
  captionFold?: Sourced<number>;
  titleMax?: Sourced<{ n: number; unit: CountUnit }>;
  descriptionMax?: Sourced<{ n: number; unit: CountUnit }>;
  maxSeconds?: Sourced<number>;
  cover: CoverSpec;
  link: LinkPlacement;
  hashtags?: Sourced<'off' | 'up_to_3' | 'allowed'>;
};

/* ------------------------------------------------------------------ the catalogue entry */

export type KitOutput = {
  /** PERSISTED on Narrative.kit. Never renamed, never removed; retired ids go in V1_ALIASES. */
  id: string;
  network: Network;
  postType: PostType;
  master: MasterAsset;
  /**
   * Outputs sharing a series render as ONE Gate 3 row and count as one decision, because you
   * never want hook 2 without hook 1. This is what keeps the screen at twelve rows while the
   * catalogue holds twenty outputs.
   */
  series?: string;
  /** The bold Gate 3 line. Identical across a series. */
  label: string;
  /** The mono line under it. Labels, not lectures: it must say something he does not know. */
  sub: string;
  /** What ONE post is called, on the Gate 4 card and the Gate 5 week chip. */
  postLabel: string;
  /**
   * Which KIND of lane shows this row, not which named lane (D45). A first-person post with
   * real stakes belongs to a person and not to a brand, and a field report across client work
   * is the brand's version of the same job. Keying on the kind means adding a teammate adds a
   * board and no branches.
   *
   * Empty means vocabulary only, deliberately off screen.
   */
  shown: StreamKind[];
  /** Ticked when the gate opens. Always a subset of `shown`. */
  on: StreamKind[];
  artifact: ArtifactSpec;
  wrapper: WrapperSpec;
  /** One line for April: what this frame is for. Never rendered on the Gate 3 screen. */
  job: string;
  /**
   * What the writer must NOT claim, because we do not know it. This is the only mechanism that
   * turns the spec's NO DATA entries into an active constraint instead of a silent omission:
   * without it, a model handed "1,300 to 2,500 characters" will happily describe the band as
   * best practice, which it is not.
   */
  doNotAssert?: string[];
  /**
   * Set when nothing downstream can produce this yet. Forces `on` empty, asserted by
   * catalogueProblems(), because a catalogue that offers what it cannot deliver is lying.
   */
  blocked?: string;
  /**
   * Manual-ness that belongs to the OUTPUT, not to the channel setting. D41 stores publish
   * mode per lane per channel, and MANUAL_BY_DEFAULT only covers marrs, so without this a
   * polynize LinkedIn document would plan as an auto entry and post as a flat image with no
   * linkedinData.type. Some things are hand-posts by nature.
   */
  handPost?: { reason: string };
  /** What the writer and the renderer must know. Never a Gate 3 row. */
  caveats?: string[];
  /**
   * Where this row sits inside its network on the Gate 3 screen, lowest first.
   *
   * SEPARATE FROM ARRAY POSITION on purpose, because array position already carries a different
   * meaning: outputForMaster returns the FIRST entry on a master, so the LinkedIn video has to sit
   * at the end of the shorts family or its 3,000 character cap would govern Instagram's captions.
   * Its place on the SCREEN is second, right after the article. One array cannot order two things,
   * so the screen gets its own number. Absent means "after the numbered ones, in array order".
   */
  row?: number;
};

/* ------------------------------------------------------------------ shared specs */

/** 660 x 960 at 120, 288. Read from ./safe-area so this file never becomes a second source. */
const VERTICAL_SAFE: SafeRect = safeRect();

/**
 * The 4:5 feed card. ONE render serves two networks: 1080 x 1350 is simultaneously LinkedIn's
 * tallest legal ratio and Instagram's recommended format, so the image playground needs one
 * primary size.
 */
const CARD_4X5 = (what: string, images = 1): VisualSpec => ({
  what,
  w: 1080,
  h: 1350,
  images,
  src: 'practitioner',
  note: '1080 wide is the ONLY official LinkedIn dimension (a525309), allowed ratios 3:1 to 4:5, max 5 MB, min 552 x 276. 4:5 as the default is a practitioner recommendation. On Instagram 1080 x 1350 is the recommended format and the only size safe under both of Instagram\'s two contradicting ratio docs. The commonly quoted 1200 x 627 is LinkedIn AD guidance and must never be used for organic.',
});

/** The LinkedIn feed text post. Shared by every frame: the frame changes, not the box. */
const LI_TEXT: ArtifactSpec = {
  kind: 'text',
  cap: { v: { n: 3000, unit: 'char' }, src: 'official', note: 'LinkedIn a528176.' },
  target: {
    v: [1300, 2500],
    src: 'large_study',
    note: 'The INTERSECTION of two studies that disagree, not a consensus. AuthoredUp (372k posts) peaks at 1,301 to 2,500 and says maxing the 3,000 cap hurts; Taplio rises monotonically past 2,000 and says it does not; van der Blom puts the sweet spot far lower at 800 to 1,000.',
  },
  floor: {
    v: 400,
    src: 'large_study',
    note: 'The only length claim AuthoredUp, Taplio and van der Blom all agree on.',
  },
  fold: {
    v: 140,
    src: 'practitioner',
    note: 'Third-party consensus, NO official figure. Desktop is nearer 210 and mobile about 140, and line breaks count, so a post built of short lines truncates earlier.',
  },
  visual: CARD_4X5("one 4:5 card carrying the post's sharpest line"),
};

const LI_TEXT_WRAP: WrapperSpec = { cover: { how: 'none' }, link: 'first_comment' };

/** Carried by every LinkedIn text frame, since every one of them is priced off the same studies. */
const LI_TEXT_UNKNOWNS: string[] = [
  'That the 1,300 to 2,500 character band is a consensus or a best practice. It is the overlap of two studies that disagree with each other, and a third puts it far lower.',
  'That the 140 character hook window is an official figure. It is third-party consensus, and on desktop the fold is nearer 210.',
  'Any post-type performance percentage, or any comparison of one to another study. The type ranking is classifier-assigned and directional only.',
  'A typical length for this specific post type. No source publishes one, so the band above is the only length guidance that exists.',
];

const ARTICLE: ArtifactSpec = {
  kind: 'longform_text',
  cap: {
    v: { n: 125000, unit: 'char' },
    src: 'official',
    note: 'LinkedIn a522483. This retires the widely repeated 110,000 figure.',
  },
  metaTitle: { v: 60, src: 'official', note: 'Truncates over 60 characters (a6244140).' },
  metaDescription: { v: [140, 160], src: 'official', note: 'LinkedIn a6244140.' },
  visual: {
    what: "one cover card, the article's claim set in type",
    w: 1080,
    h: 1350,
    images: 1,
    src: 'ours',
    note: 'LinkedIn publishes NO cover or header image spec for an article anywhere. We reuse the feed card size so one render serves the article and its cutdown post. The requirement itself is the operator\'s ("every post, even the article"), not a platform rule.',
  },
};

const ARTICLE_WRAP: WrapperSpec = { cover: { how: 'none' }, link: 'is_the_url' };

const LI_PDF: ArtifactSpec = {
  kind: 'pdf',
  pages: {
    v: [7, 12],
    src: 'practitioner',
    note: 'LOOSE consensus only: Oktopost says 5 to 15, Metricool 7 to 15. NO completion-rate data exists behind any of these numbers. The official limits are 100 MB and 300 pages (a518909).',
  },
  marginPx: { v: 50, src: 'practitioner', note: 'Oktopost.' },
  minFontPt: {
    v: 24,
    src: 'practitioner',
    note: 'Oktopost: under 20 pt is unreadable on mobile without zoom.',
  },
  maxWordsPerPage: { v: 60, src: 'practitioner', note: 'Oktopost: 6 to 8 lines maximum.' },
  visual: {
    what: 'a cover carrying one specific claim, body pages alternating text-led and visual-led, a close with one takeaway and one CTA',
    w: 1080,
    h: 1350,
    /** The UPPER bound for the renderer. The honest range is `pages`, which is a range. */
    images: 12,
    src: 'practitioner',
    note: 'THIRD-PARTY ONLY. LinkedIn publishes organic document dimensions nowhere; its only page-size guidance is in ad docs. Every page must be the same size (official a518909) and animation flattens to a static image.',
  },
};

const LI_PDF_WRAP: WrapperSpec = {
  captionMax: {
    v: { n: 3000, unit: 'char' },
    src: 'official',
    note: 'The same feed-post cap (a528176). The spec wants 100 to 200 words with the hook inside the first 140 characters.',
  },
  captionFold: { v: 140, src: 'practitioner', note: 'Third-party consensus, no official figure.' },
  cover: { how: 'none' },
  link: 'caption_and_first_comment',
};

const IG_WRAP: WrapperSpec = {
  captionMax: { v: { n: 2200, unit: 'char' }, src: 'official', note: 'Graph API.' },
  captionFold: {
    v: 125,
    src: 'practitioner',
    note: "Instagram publishes NO official figure. Third-party consensus that happens to match Meta's own ads-guide recommendation for primary text.",
  },
  cover: { how: 'none' },
  link: 'unspecified',
  hashtags: {
    v: 'off',
    src: 'large_study',
    note: 'Metricool 2026, 24.4M posts: posts carrying hashtags saw 31.70% fewer views and 33.89% fewer interactions than platform average. A direct reversal of common practice, so OFF is the default.',
  },
};

const IG_SWIPE: ArtifactSpec = {
  kind: 'image_set',
  visual: {
    what: 'ten slides: a hook slide, then one idea per slide, closing on the takeaway',
    w: 1080,
    h: 1350,
    images: 10,
    src: 'official',
    note: '10 is the hard ceiling FOR US: the content publishing API caps a carousel at 10 items and Metricool is an API client, so 11 to 20 can only be posted by hand. Every slide is cropped to the FIRST slide\'s dimensions, so all ten must be generated at one size.',
  },
};

const IG_CARD: ArtifactSpec = {
  kind: 'image_set',
  visual: {
    what: 'one 4:5 card, the idea reduced to a single readable claim',
    w: 1080,
    h: 1350,
    images: 1,
    src: 'official',
    note: "The recommended format per official help, and the only size safe under BOTH of Instagram's contradicting ratio docs (the live page says 1.91:1 to 3:4 with height to 1440, the cached page and the Graph API say 1.91:1 to 4:5 with height to 1350). 1080 x 1440 would be rejected or cropped. Text on an image is NOT penalised: Meta retired the 20% text rule and its checker.",
  },
};

/** The one master file behind nine outputs: one clean unwatermarked export, published natively. */
const VERTICAL_VIDEO: ArtifactSpec = {
  kind: 'video',
  frame: {
    w: 1080,
    h: 1920,
    src: 'practitioner',
    note: 'Instagram accepts 1.91:1 to 9:16 and recommends 9:16 (official). YouTube treats square or vertical up to 3 minutes as a Short (official). TikTok publishes NO aspect-ratio requirement for organic video at all, so 1080 x 1920 there is a Hootsuite and Sprout recommendation, not a TikTok figure.',
  },
  minFps: { v: 30, src: 'official', note: 'Instagram help: 30 FPS and 720 px minimum.' },
  safeArea: VERTICAL_SAFE,
  visual: {
    what: "the first frame of the cut, pre-caption, carrying the hook text clear of the presenter's face",
    w: 1080,
    h: 1920,
    images: 1,
    src: 'ours',
    note: 'House rule: the first frame IS the cover, taken from the pre-caption cut, so the platform cannot pick a bad one.',
  },
};

const VIDEO_UNKNOWNS: string[] = [
  'A target duration. Not one of these platforms publishes one. The figures that circulate are watch time, not optimal length, or five-year-old ad conversion data.',
  'That the safe area is generous. It is the worst case across every platform this goes to and it is tighter than anyone assumes.',
];

const IG_REEL_WRAP: WrapperSpec = {
  ...IG_WRAP,
  maxSeconds: {
    v: 180,
    src: 'official',
    note: 'Over 3 minutes is not recommended to new audiences (official help). The duration sources are officially self-contradictory: in-app recording allows 20 minutes, the API and ads guide say 15. Only the 3-minute recommendation is consistent in effect.',
  },
  cover: {
    how: 'upload',
    w: 420,
    h: 654,
    src: 'official',
    note: 'Recommended 420 x 654 (1:1.55) per official help. Sources CONFLICT on whether it can be changed after posting. The grid crop is 1080 x 1440 against 1080 x 1920 in feed (Hootsuite, third-party), which decides whether the first frame reads in the grid.',
  },
};

const TT_WRAP: WrapperSpec = {
  captionMax: {
    v: { n: 2200, unit: 'rune' },
    src: 'official',
    note: 'UTF-16 RUNES, not characters (direct post reference). The widespread 4,000 figure has no TikTok source. There is deliberately no captionFold here: TikTok publishes no truncation figure at all and third-party claims span 55 to 150 characters.',
  },
  maxSeconds: {
    v: 180,
    src: 'official',
    note: 'The safe floor, not the ceiling. All creators get 3 minutes, some get 5 or 10, and a client MUST query the per-creator max_video_post_duration_sec. 10 minutes is the documented ceiling; the 60-minute figure in most blogs has no TikTok source.',
  },
  cover: {
    how: 'pick_frame',
    src: 'official',
    note: 'Frame selection ONLY: pick and drag a frame before posting. Custom image upload is not documented and no cover size or format spec is published anywhere.',
  },
  link: 'unspecified',
};

const YT_SHORT_WRAP: WrapperSpec = {
  titleMax: { v: { n: 100, unit: 'char' }, src: 'official', note: 'Data API.' },
  descriptionMax: {
    v: { n: 5000, unit: 'byte' },
    src: 'official',
    note: 'BYTES, not characters (Data API). Emoji and CJK eat 3 to 4 bytes each, so a 5,000 CHARACTER description can fail.',
  },
  maxSeconds: {
    v: 180,
    src: 'official',
    note: 'Square or vertical up to 3 minutes is what makes it a Short (answer/15424877). The 60-second figure everyone still quotes is obsolete.',
  },
  cover: {
    how: 'upload',
    w: 2160,
    h: 3840,
    src: 'official',
    note: 'Custom Shorts thumbnails exist since 24 July 2026: 2160 x 3840, 9:16, JPG or PNG, under 50 MB, YPP creators only, desktop Studio only, verified account, no A/B testing. Whether OUR account is eligible is unconfirmed, and Hootsuite and Buffer both still document this as impossible, so a pipeline built off third-party specs guides silently skips the step.',
  },
  link: 'unspecified',
  hashtags: {
    v: 'up_to_3',
    src: 'official',
    note: 'answer/6390658: three surface above the title, and over 60 hashtags means EVERY hashtag is ignored.',
  },
};

/**
 * LINKEDIN VIDEO (D46). The same clean vertical export, captioned for LinkedIn.
 *
 * Everything here except the caption cap is OURS, because the output spec has no LinkedIn video
 * section at all: its LinkedIn sections are the text post, the document carousel and the article.
 * The only LinkedIn video datum anywhere in it is negative.
 */
const LI_VIDEO_WRAP: WrapperSpec = {
  captionMax: {
    v: { n: 3000, unit: 'char' },
    src: 'official',
    note: 'The same feed-post cap (a528176).',
  },
  captionFold: { v: 140, src: 'practitioner', note: 'Third-party consensus, no official figure.' },
  // No cover. LinkedIn documents no custom video thumbnail upload for organic posts and the spec
  // states none, so claiming a size would be inventing one.
  cover: { how: 'none' },
  link: 'first_comment',
};

const YT_WIDE: ArtifactSpec = {
  kind: 'video',
  frame: {
    w: 1920,
    h: 1080,
    src: 'official',
    note: '16:9 opts a video OUT of Shorts classification (answer/15424877). That is the ONLY thing the output spec says about wide video: no duration, no chapter or description structure, no performance data.',
  },
  // safeArea ABSENT on purpose. The vertical envelope is meaningless on a 16:9 frame and the
  // output spec gives wide video no safe area at all, so any number here would be invented.
  visual: {
    what: 'one 16:9 thumbnail',
    w: 1280,
    h: 720,
    images: 1,
    src: 'ours',
    note: 'NOT IN THE OUTPUT SPEC. The spec states no wide-thumbnail size. 1280 x 720 is carried so the required image has some size, and it must be confirmed before this output ships.',
  },
};

const YT_LONG_WRAP: WrapperSpec = {
  titleMax: { v: { n: 100, unit: 'char' }, src: 'official', note: 'Data API.' },
  descriptionMax: {
    v: { n: 5000, unit: 'byte' },
    src: 'official',
    note: 'Bytes, not characters.',
  },
  cover: {
    how: 'upload',
    w: 1280,
    h: 720,
    src: 'ours',
    note: 'NOT IN THE OUTPUT SPEC. Confirm before this ships.',
  },
  link: 'unspecified',
  hashtags: { v: 'up_to_3', src: 'official', note: 'Three surface above the title.' },
};

const BOTH: StreamKind[] = ['person', 'company'];
const PERSON: StreamKind[] = ['person'];
const COMPANY: StreamKind[] = ['company'];
const NEITHER: StreamKind[] = [];

/* ------------------------------------------------------------------ THE CATALOGUE
 *
 * Twenty two outputs, ELEVEN Gate 3 rows per lane, FIFTEEN default posts, SEVEN Gate 4 cards.
 * Order is screen order: LinkedIn, Instagram, TikTok, YouTube. Inside LinkedIn the article
 * comes first, because it is the source the text posts are cut from.
 *
 * WHY THREE TEXT POSTS AND NOT FOUR (Marrs: "maybe four is too much"). Supply: the Gate 2
 * article is 300 to 450 words, roughly ONE text post's worth of material at the 1,300 to 2,500
 * character band, so four posts is not a cut, it is a thousand words of invention. Capacity:
 * at four, a narrative's LinkedIn output is 6 posts, which at three narratives a week is 18 against
 * 14 slots.
 *
 * WHY DIFFERENT FRAMES AND NEVER THE SAME ONE TWICE. The types differ in WHICH engagement they
 * produce, not only how much: the listicle is a comment machine with ordinary ER, the hard
 * moment is the reverse. Those are different mechanisms, and the ranking behind them is
 * classifier-assigned on somebody else's audience, so you diversify precisely because the
 * numbers are not trustworthy enough to concentrate. It is also the only shape that can ever
 * learn: three frames on one idea, with the idea held constant, is a within-narrative comparison.
 *
 * WHY FOUR FRAMES ARE OFF THE SCREEN (win, challenge, recap, explainer). A row he has to decide
 * about every single week, to serve the rare week he has the material, is exactly the overload
 * he named. They stay in the vocabulary as one-tap swaps and off the default screen.
 *
 * THE POST-TYPE FIGURES quoted in `job` and `caveats` come from MagicPost, 1,141,932 posts to
 * 5 June 2026, personal profiles only, and are CLASSIFIER-ASSIGNED. They are directional only
 * and their absolute percentages are NOT comparable to any other study quoted in this file.
 */
const CATALOGUE: KitOutput[] = [
  /* ------------------------------------------------------------ LinkedIn */
  {
    // v1 id, unchanged: same end state, so reusing the id beats aliasing it.
    id: 'li_article',
    row: 1,
    network: 'linkedin',
    postType: 'pulse_article',
    master: 'article',
    label: 'Article',
    sub: 'own url, plus a cover image',
    postLabel: 'Article',
    shown: BOTH,
    on: BOTH,
    artifact: ARTICLE,
    wrapper: ARTICLE_WRAP,
    job: 'The argument at full length on a Google-indexable url, so the idea has somewhere permanent to live.',
    doNotAssert: [
      'That LinkedIn suppresses articles algorithmically. No official source supports it, and LinkedIn\'s own docs draw no distributional distinction between posts and articles.',
    ],
    caveats: [
      'Reach is 0.69x and engagement 0.44x a text post (AuthoredUp, 372k posts), but article reach fell only 6% year on year against 36% for video. A durability and search play, not a reach play.',
      'The output spec requires the article to ALSO ship as a cutdown text post. That is the contrarian frame on the marrs lane and the listicle on polynize, not a fourth item.',
      'UNRESOLVED: D40 fixes the Gate 2 article at 300 to 450 words, roughly 1,800 to 2,700 characters, which is nearly the same length as its own cutdown post. The spec assumes a genuine long form.',
    ],
  },
  {
    id: 'li_text_contrarian',
    row: 3,
    network: 'linkedin',
    postType: 'contrarian',
    // 'texts' is the v1 value, kept so an in-flight narrative's existing text piece is ADOPTED as
    // this frame rather than orphaned. Which is also why the contrarian frame is the one that
    // gets it: it is the article's cutdown, the closest thing to what v1's piece already held.
    master: 'texts',
    label: 'Contrarian post',
    sub: 'the belief, then the break',
    postLabel: 'Contrarian post',
    shown: BOTH,
    on: BOTH,
    artifact: LI_TEXT,
    wrapper: LI_TEXT_WRAP,
    job: "State the belief the article argues against, then break it. This is the article's cutdown, so its argument reaches the feed instead of only living on Pulse.",
    doNotAssert: LI_TEXT_UNKNOWNS,
    caveats: [
      '0.49% ER and 14 comments. Mid-table ER, high comments, and comments are the distribution signal, so this is a reach play whose ER looks ordinary.',
      'Close on a question: posts that include one get 77% more comments (Metricool, 673k posts).',
      'RISK: contrarian with nothing real behind it is manufactured disagreement, the most detectable form of LinkedIn slop. If the article carries no actual position, take the field report instead of inventing one.',
    ],
  },
  {
    id: 'li_text_hard_moment',
    row: 4,
    network: 'linkedin',
    postType: 'hard_moment',
    master: 'texts_hard',
    label: 'Hard moment',
    sub: 'what holding it cost',
    postLabel: 'Hard moment',
    shown: PERSON,
    on: PERSON,
    artifact: LI_TEXT,
    wrapper: LI_TEXT_WRAP,
    job: 'The price paid for holding that position, in first person, with the stakes named.',
    doNotAssert: [
      ...LI_TEXT_UNKNOWNS,
      'Any cost, failure, loss or hardship the source material does not actually contain. This post is on his own profile under his own name, so an invented moment is worse here than anywhere else in the kit.',
    ],
    caveats: [
      '0.80% ER and 16 comments: the highest comment count inside the top ER band.',
      "This lane's structural advantage: a personal profile beats a company page by 63% engagement at similar impressions (Metricool 2026), corroborated by peer-reviewed work finding interpersonal and observational posts drew significantly more comments than expertise posts (Usera, Cox and Walker, SAGE Open, March 2026).",
      'THE MOST DANGEROUS DEFAULT IN THE SET: it needs a real cost actually paid, and a 400-word article about an idea usually contains none. It must degrade to the field report rather than fabricate.',
    ],
  },
  {
    id: 'li_text_listicle',
    row: 5,
    network: 'linkedin',
    postType: 'listicle',
    master: 'texts_list',
    label: 'Numbered rules',
    sub: 'the reach play',
    postLabel: 'Numbered rules',
    shown: BOTH,
    on: BOTH,
    artifact: LI_TEXT,
    wrapper: LI_TEXT_WRAP,
    job: 'Teach the article as numbered rules, so the idea carries into feeds that never saw the other two posts.',
    doNotAssert: LI_TEXT_UNKNOWNS,
    caveats: [
      '0.49% ER but 23 comments, the highest comment count in the whole 1.1M-post set.',
      'On the polynize lane this is the default carrier instead of an explainer: the same teaching job, and 23 comments against the explainer\'s 4. The ER gap between them is 0.09 points, exactly the kind of number the spec says not to trust, so the pick is made on comments.',
    ],
  },
  {
    id: 'li_text_field_report',
    row: 4,
    network: 'linkedin',
    postType: 'field_report',
    master: 'texts_field',
    label: 'Field report',
    sub: 'what we see across client work',
    postLabel: 'Field report',
    shown: COMPANY,
    on: COMPANY,
    artifact: LI_TEXT,
    wrapper: LI_TEXT_WRAP,
    job: 'What the pattern looks like across client work, with no named client and nothing needing sign off.',
    doNotAssert: [
      ...LI_TEXT_UNKNOWNS,
      'Any client name, logo, figure or outcome the source material does not contain. The whole point of this frame is that it needs no sign off, which only holds if nothing identifiable is in it.',
    ],
    caveats: [
      '0.63% ER and 8 comments. Beats the explainer on both columns, which is why this lane is not actually stuck in the 0.40 to 0.49% band: it is stuck there only if it chooses explainer.',
      'Chosen over the situation recap (0.68% ER, 9 comments) on an operational tie-break rather than the numbers, which are inside the noise floor: a field report needs no client sign off and a case recap usually does.',
    ],
  },
  {
    // v1 id, unchanged: still exactly one LinkedIn document post.
    id: 'li_car',
    row: 9,
    network: 'linkedin',
    postType: 'document',
    master: 'carousel',
    label: 'Document carousel',
    sub: 'no pdf builder yet',
    postLabel: 'Document',
    shown: BOTH,
    on: NEITHER,
    artifact: LI_PDF,
    wrapper: LI_PDF_WRAP,
    job: 'The same slide narrative as the Instagram carousel, rendered as a swipeable PDF document.',
    blocked:
      'Two independent reasons. The console has NO pdf generation at all, no library and no dependency. And whether Metricool can schedule a LinkedIn document post is UNVERIFIED, because our client only ever sends media[] and never the linkedinData.type field their API documents.',
    handPost: {
      reason:
        'A LinkedIn document cannot be scheduled through Metricool at all, so this is a hand-post by nature rather than by channel setting. Without this the polynize lane would plan it as an auto entry and it would post as a flat image.',
    },
    caveats: [
      'Documents are the best reach multiplier on the platform: 1,198 median reach against 921 for a text post and 596 for an article, posted by only 4.88% of creators (AuthoredUp). Worth unblocking.',
      'Every page must be SELF-CONTAINED, which is a platform constraint and not a preference: animation flattens to a static image, and links inside the PDF are unreliable to dead, especially in the mobile app.',
      'A prezie frame is the WRONG source: its slides depend on a voiceover a carousel does not have.',
    ],
  },
  // Vocabulary only: available as a swap, deliberately off the default screen.
  {
    id: 'li_text_explainer',
    network: 'linkedin',
    postType: 'explainer',
    master: 'texts_list',
    label: 'Explainer',
    sub: 'teaching the mechanism',
    postLabel: 'Explainer',
    shown: NEITHER,
    on: NEITHER,
    artifact: LI_TEXT,
    wrapper: LI_TEXT_WRAP,
    job: 'Teach the mechanism straight, without a list and without a position.',
    doNotAssert: LI_TEXT_UNKNOWNS,
    caveats: [
      '0.40% ER and 4 comments, the lowest comment count in the set. Not a default on either lane, because the article and the carousel are already explainers and a third one is the same voice three times on one channel in one week.',
    ],
  },

  /* ------------------------------------------------------------ Instagram */
  {
    id: 'ig_reel_1',
    network: 'instagram',
    postType: 'vertical_video',
    master: 'shorts',
    series: 'reels',
    label: 'Reels',
    sub: 'your 3 hooks, one body',
    postLabel: 'Reel',
    shown: BOTH,
    on: BOTH,
    artifact: VERTICAL_VIDEO,
    wrapper: IG_REEL_WRAP,
    job: 'The argument to camera, one hook per cut, same body.',
    doNotAssert: VIDEO_UNKNOWNS,
    caveats: [
      'Reels get 30% fewer views than TikTok videos (Metricool), and Meta reports Reels ads built 9:16 with audio and key creative inside the safe zone had 34.5% lower cost per result. That last figure is AD data.',
      'No visible watermark. Content copied without material edits is unoriginal, and borders, watermarks, speed changes and crediting the original do NOT count as material edits. 10+ reposts in 30 days loses recommendation eligibility.',
    ],
  },
  {
    id: 'ig_reel_2',
    network: 'instagram',
    postType: 'vertical_video',
    master: 'shorts',
    series: 'reels',
    label: 'Reels',
    sub: 'your 3 hooks, one body',
    postLabel: 'Reel',
    shown: BOTH,
    on: BOTH,
    artifact: VERTICAL_VIDEO,
    wrapper: IG_REEL_WRAP,
    job: 'The second hook against the same body.',
    doNotAssert: VIDEO_UNKNOWNS,
  },
  {
    id: 'ig_reel_3',
    network: 'instagram',
    postType: 'vertical_video',
    master: 'shorts',
    series: 'reels',
    label: 'Reels',
    sub: 'your 3 hooks, one body',
    postLabel: 'Reel',
    shown: BOTH,
    on: BOTH,
    artifact: VERTICAL_VIDEO,
    wrapper: IG_REEL_WRAP,
    job: 'The third hook against the same body.',
    doNotAssert: VIDEO_UNKNOWNS,
  },
  {
    // v1 id, unchanged.
    id: 'ig_car',
    network: 'instagram',
    postType: 'swipe',
    master: 'carousel',
    label: 'Carousel',
    sub: '10 slides, generated',
    postLabel: 'Carousel',
    shown: BOTH,
    on: BOTH,
    artifact: IG_SWIPE,
    wrapper: IG_WRAP,
    job: 'The idea as ten self-contained slides, each one landing on its own.',
    doNotAssert: [
      'That 10 slides is a tested optimum. The 22M-post study that measured 10 as best PREDATES the 20-slide limit, so 10 was the cap rather than an optimum, and nothing tests 11 to 20.',
      'That hashtags help. A 24.4M-post study measured 31.70% fewer views on posts carrying them.',
    ],
    caveats: [
      'Carousels beat single images on every metric with 9x more saves (Metricool 2026, 24.4M posts), and Instagram carousels get 4.7x the views of TikTok carousels. This is the carousel\'s home platform.',
      'GENERATED, not extracted: the slide narrative first, then per-slide image prompts, then generation, then text overlay.',
    ],
  },
  {
    // v1 id ig_img aliases here. Three near-identical quote cards became one, on the spec's own
    // data: single-image reach fell 21.96% year on year and carousels beat them on every metric.
    id: 'ig_card',
    network: 'instagram',
    postType: 'card',
    master: 'images',
    label: 'Image',
    sub: 'one 4:5 card',
    // 'Image', not 'Card': the Gate 3 row, the Gate 4 card and this chip are one word now (D54).
    postLabel: 'Image',
    shown: BOTH,
    on: BOTH,
    artifact: IG_CARD,
    wrapper: IG_WRAP,
    job: 'The idea reduced to one line a reader can take in without stopping.',
    doNotAssert: [
      'That single images get 30% less reach than text-only. That circulating claim has NO traceable dataset, the page most cited for it contains no numbers and disclaims having them, and four independent studies point the other way.',
      'That hashtags help.',
    ],
    caveats: [
      'The weakest Instagram play in the spec: single-image reach fell 21.96% year on year. One card, not three, is the honest number.',
    ],
  },

  /* ------------------------------------------------------------ TikTok */
  {
    id: 'tt_1',
    network: 'tiktok',
    postType: 'vertical_video',
    master: 'shorts',
    series: 'tiktoks',
    label: 'TikToks',
    sub: 'same cuts, tiktok caption',
    postLabel: 'TikTok',
    shown: BOTH,
    on: BOTH,
    artifact: VERTICAL_VIDEO,
    wrapper: TT_WRAP,
    job: 'The same cut, captioned for TikTok, with the cover picked from a frame.',
    doNotAssert: [
      ...VIDEO_UNKNOWNS,
      'A caption truncation point for TikTok. It publishes none, and third-party claims span 55 to 150 characters, so any "first N characters" rule here would be invented.',
      "That 21 to 34 seconds is the optimal length. That figure is TikTok's own AD data from December 2021 measuring a conversion lift, not organic retention.",
    ],
    caveats: [
      'Video wins on TikTok: 3.39% median engagement against 1.92% for photo carousels (Buffer, 45M+ posts).',
      "TikTok's originality policy names SOMEONE ELSE'S visible watermark or superimposed logo as not original in most cases. Instagram's rule is stricter and covers any watermark, so the stricter rule governs: export clean.",
      "The safe area here is OURS BY MEASUREMENT, off TikTok's own In-Feed ad template, not published by TikTok. It reserves room for an ad CTA button an organic post does not have.",
    ],
  },
  {
    id: 'tt_2',
    network: 'tiktok',
    postType: 'vertical_video',
    master: 'shorts',
    series: 'tiktoks',
    label: 'TikToks',
    sub: 'same cuts, tiktok caption',
    postLabel: 'TikTok',
    shown: BOTH,
    on: BOTH,
    artifact: VERTICAL_VIDEO,
    wrapper: TT_WRAP,
    job: 'The second cut on TikTok.',
    doNotAssert: VIDEO_UNKNOWNS,
  },
  {
    id: 'tt_3',
    network: 'tiktok',
    postType: 'vertical_video',
    master: 'shorts',
    series: 'tiktoks',
    label: 'TikToks',
    sub: 'same cuts, tiktok caption',
    postLabel: 'TikTok',
    shown: BOTH,
    on: BOTH,
    artifact: VERTICAL_VIDEO,
    wrapper: TT_WRAP,
    job: 'The third cut on TikTok.',
    doNotAssert: VIDEO_UNKNOWNS,
  },

  /* ------------------------------------------------------------ YouTube */
  {
    id: 'yt_short_1',
    network: 'youtube',
    postType: 'vertical_video',
    master: 'shorts',
    series: 'shorts',
    label: 'Shorts',
    sub: 'same cuts, own title and thumbnail',
    postLabel: 'Short',
    shown: BOTH,
    on: BOTH,
    artifact: VERTICAL_VIDEO,
    wrapper: YT_SHORT_WRAP,
    job: 'The same cut as a Short, with its own 100-character title and an uploaded 9:16 thumbnail.',
    doNotAssert: [
      ...VIDEO_UNKNOWNS,
      'A target duration for Shorts. YouTube publishes no benchmark at all; the sources that do are five years old, from a 60-second-max era, or cite no sample size, and they contradict each other.',
    ],
    caveats: [
      'The Shorts feed is now 61% of all YouTube views, and Shorts views rose 127% year on year (Metricool 2026).',
      'COPYRIGHT TRAP: any Short over one minute with an active copyright claim is BLOCKED GLOBALLY and cannot be monetised. Licensed music in a long Short is a hard fail, not a warning.',
      'The description limit is in BYTES. A 5,000-character description with emoji in it can fail.',
    ],
  },
  {
    id: 'yt_short_2',
    network: 'youtube',
    postType: 'vertical_video',
    master: 'shorts',
    series: 'shorts',
    label: 'Shorts',
    sub: 'same cuts, own title and thumbnail',
    postLabel: 'Short',
    shown: BOTH,
    on: BOTH,
    artifact: VERTICAL_VIDEO,
    wrapper: YT_SHORT_WRAP,
    job: 'The second cut as a Short.',
    doNotAssert: VIDEO_UNKNOWNS,
  },
  {
    id: 'yt_short_3',
    network: 'youtube',
    postType: 'vertical_video',
    master: 'shorts',
    series: 'shorts',
    label: 'Shorts',
    sub: 'same cuts, own title and thumbnail',
    postLabel: 'Short',
    shown: BOTH,
    on: BOTH,
    artifact: VERTICAL_VIDEO,
    wrapper: YT_SHORT_WRAP,
    job: 'The third cut as a Short.',
    doNotAssert: VIDEO_UNKNOWNS,
  },
  /**
   * LINKEDIN'S VIDEO POST, and it is deliberately LAST in the shorts family.
   *
   * WHY IT EXISTS. His slot structure names video as one of LinkedIn's two daily posts (D44), and
   * the kit produced NO video on LinkedIn at all: every other LinkedIn output is a text master or
   * the blocked document. So a video-preferring morning slot had nothing to draw from, and the
   * feature that motivated this build would have been inert on the one channel it was for.
   *
   * WHY IT IS A BET RATHER THAN A GAP. The only LinkedIn video figure in the output spec is
   * negative: median reach down 36% year on year, corroborated twice. The spec has no LinkedIn
   * video section, and its cross-posting section names Instagram, TikTok and YouTube only. Adding
   * this is a maximalist bet against the only evidence we have, which is consistent with D44 and
   * is recorded as a bet rather than dressed up as filling a hole.
   *
   * WHY LAST IN THE ARRAY. outputForMaster() returns the FIRST catalogue entry on a master, and
   * bodyCapFor and checkBody read it. Putting this first on 'shorts' would make LinkedIn's 3,000
   * character cap govern Instagram and TikTok captions capped at 2,200.
   *
   * NOT a series: one cut on LinkedIn, not three. Three near-identical videos on the channel whose
   * video reach is falling is volume without an argument for it.
   */
  {
    id: 'li_short',
    row: 2,
    network: 'linkedin',
    postType: 'vertical_video',
    master: 'shorts',
    label: 'Video',
    sub: 'one cut, linkedin caption',
    postLabel: 'Video',
    shown: BOTH,
    on: BOTH,
    artifact: VERTICAL_VIDEO,
    wrapper: LI_VIDEO_WRAP,
    job: 'The strongest cut, captioned for LinkedIn, so the morning slot carries video.',
    doNotAssert: [
      ...VIDEO_UNKNOWNS,
      'Anything about how LinkedIn video performs or should be built. The output spec has no LinkedIn video section, and its one LinkedIn video figure is a 36% year on year fall in median reach.',
    ],
    caveats: [
      'LinkedIn video median reach fell 36% year on year, the steepest decline of any format in the spec (AuthoredUp, corroborated by Socialinsider). This output exists because the operator wants the surface area, not because the data asks for it.',
      'Same file as the reels, TikToks and Shorts. One clean unwatermarked export, published natively, captioned per platform.',
    ],
  },
  {
    // v1 id, unchanged, and still off by default.
    id: 'yt_l',
    network: 'youtube',
    postType: 'wide_video',
    master: 'long',
    label: 'Long form',
    sub: 'no long edit exists yet',
    postLabel: 'Long form',
    shown: BOTH,
    on: NEITHER,
    artifact: YT_WIDE,
    wrapper: YT_LONG_WRAP,
    job: 'The argument at length, 16:9, deliberately not a Short.',
    blocked: 'No long-form edit pipeline exists, so ticking it is a promise Gate 4 cannot keep.',
    doNotAssert: [
      'Anything about how a 16:9 YouTube video should be built. The output spec gives wide video NO end state at all: no duration, no thumbnail spec, no chapter or description structure, no performance data.',
    ],
  },
];

/**
 * RETIRED TICK IDS. Frozen, append-only, never edited.
 *
 * Narrative.kit is persisted, and piecesForTicks deliberately ignores ids it does not recognise, so
 * dropping an id does not error: it silently deletes those posts from every narrative already saved.
 * A narrative whose ticks all fail to resolve sits at Gate 5 with an empty week and a dead button.
 *
 * `li_posts` is lane-dependent, which is why every resolver takes the lane.
 */
const V1_ALIASES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  ig_reels: ['ig_reel_1', 'ig_reel_2', 'ig_reel_3'],
  ig_img: ['ig_card'],
  tt_v: ['tt_1', 'tt_2', 'tt_3'],
  yt_s: ['yt_short_1', 'yt_short_2', 'yt_short_3'],
});

/** `li_posts` was v1's untyped "4 posts". It becomes the lane's three frames, by kind. */
function aliasFor(id: string, lane: NarrativeLane): readonly string[] | undefined {
  if (id === 'li_posts') {
    return streamKind(lane) === 'person'
      ? ['li_text_contrarian', 'li_text_hard_moment', 'li_text_listicle']
      : ['li_text_contrarian', 'li_text_listicle', 'li_text_field_report'];
  }
  return V1_ALIASES[id];
}

export const KIT_NETWORK_ORDER: readonly Network[] = [
  'linkedin',
  'instagram',
  'tiktok',
  'youtube',
];

const BY_ID = new Map(CATALOGUE.map((o) => [o.id, o]));

/* ------------------------------------------------------------------ lookups */

export function outputById(id: string): KitOutput | undefined {
  return BY_ID.get(id);
}

/** One name for one post, for the Gate 5 week chip and anywhere else a post is named. */
export function labelFor(id: string): string {
  return BY_ID.get(id)?.postLabel ?? 'Post';
}

/**
 * ONE NAME PER THING, ACROSS ALL THREE GATES (D54).
 *
 * Marrs: "the item labelled on Gate 3 has to be similar to the one on Gate 4. For example, the
 * Instagram image on Gate 4 says 'card'. That doesn't make sense. There has to be some continuity
 * between the two."
 *
 * There were three separate vocabularies and nobody had ever lined them up. The single-image
 * master was the worst: Gate 3 said "Image", Gate 4 said "Quote card", Gate 5 said "Card". Three
 * words for one thing.
 *
 * THE RULE NOW. `card` is the canonical name and it matches the Gate 3 row exactly. The detail
 * about how the thing is made moved to `detail`, which the Gate 4 card prints as a second line
 * rather than smuggling into the name. Gate 5's chip uses the output's own `postLabel`, and the
 * ONE place a different word is allowed is where the platform has its own: a video is a Reel on
 * Instagram, a Short on YouTube and a TikTok on TikTok, which is that platform's vocabulary and
 * not an inconsistency. "Card" was not Instagram's word for anything.
 */
const MASTER_META: Record<
  MasterAsset,
  { kind: 'text' | 'video' | 'image'; card: string; detail?: string; rank: number }
> = {
  // Gate 4 order: video first because it is the long pole, then image, then text.
  shorts: { kind: 'video', card: 'Video', detail: 'one script, 3 hooks and one body', rank: 0 },
  long: { kind: 'video', card: 'Long form', detail: '16:9, deliberately not a Short', rank: 1 },
  carousel: { kind: 'image', card: 'Carousel', detail: '10 slides at 1080 x 1350', rank: 2 },
  images: { kind: 'image', card: 'Image', detail: 'one 4:5 card', rank: 3 },
  article: { kind: 'text', card: 'Article', detail: 'the long form, on its own url', rank: 4 },
  texts: { kind: 'text', card: 'Contrarian post', detail: 'the belief, then the break', rank: 5 },
  texts_hard: { kind: 'text', card: 'Hard moment', detail: 'what holding it cost', rank: 6 },
  texts_list: { kind: 'text', card: 'Numbered rules', detail: 'the reach play', rank: 7 },
  texts_field: { kind: 'text', card: 'Field report', detail: 'what we see across client work', rank: 8 },
};

/** The line under a Gate 4 card's name: how the thing is made, not what it is called. */
export function masterDetail(m: string): string {
  return MASTER_META[m as MasterAsset]?.detail ?? '';
}

export function masterKind(m: MasterAsset): 'text' | 'video' | 'image' {
  return MASTER_META[m]?.kind ?? 'text';
}

export function masterCardLabel(m: string): string {
  return MASTER_META[m as MasterAsset]?.card ?? 'Post';
}

/**
 * The first output on a master, which is where its ARTIFACT spec lives (the artifact is shared
 * by every output on a master, by definition: that is what a master is). Keyed off the PERSISTED
 * value, so a piece is enough to find its spec.
 *
 * Do NOT read the WRAPPER off this. A master can serve several networks and the wrapper is
 * exactly the part that differs between them, which is why outputsOnMaster exists.
 */
export function outputForMaster(m: string): KitOutput | undefined {
  /**
   * BLOCKED OUTPUTS ARE SKIPPED (D47), and that is not a nicety.
   *
   * The carousel master serves li_car (the LinkedIn PDF) and ig_car (the Instagram swipe), and
   * li_car comes first in the array. li_car is blocked and planned nowhere, yet
   * promptFragment('carousel') was briefing April to its artifact: "7 to 12 pages, under 60 words
   * each", the spec for a document nobody is making, instead of the ten 1080 x 1350 slides that
   * are actually planned. bodyCapFor read the wrong caption cap off the same entry.
   *
   * Keyed on `blocked` rather than on "defaults on somewhere", because blocked is the property
   * that means CANNOT BE PRODUCED. An output that is merely off by default is still a real end
   * state whose spec is correct, and briefing April from it would not be wrong.
   *
   * A master whose outputs are ALL blocked still returns its first, because a label beats nothing.
   */
  return (
    CATALOGUE.find((o) => o.master === m && !o.blocked) ?? CATALOGUE.find((o) => o.master === m)
  );
}

/**
 * How many images this master's post needs. 10 for the carousel, 1 for the quote card, 1 for a
 * text post's required visual, 1 for a video's cover frame. Read off the artifact rather than
 * guessed, so a change to the spec moves the count with it.
 */
export function expectedImages(m: string): number {
  const o = outputForMaster(m);
  return o ? o.artifact.visual.images : 1;
}

export type CardState = 'empty' | 'drafted' | 'ready';

/**
 * WHETHER A GATE 4 CARD IS FINISHED (D47).
 *
 * Gate 4 used to show seven visually identical cards with a live "Lay out the week" button under
 * them, so a card with no script and no media looked exactly like a finished one, and the most
 * likely thing to do on the screen was also the thing that laid out a wave of empty posts.
 *
 * 'ready' means it could ship: the words exist AND the images are attached. 'drafted' means the
 * words exist and the pictures do not, which is the normal state of a video piece before the
 * shoot. This is advisory, never a block: media now refreshes on every replan, so attaching
 * images after the wave is laid out works, and the operator does not need protecting from an
 * order that is no longer destructive.
 */
export function cardState(
  master: string,
  piece: { body?: string; script?: string; media?: string[] }
): CardState {
  const media = piece.media?.length ?? 0;
  const kind = masterKind(master as MasterAsset);
  if (kind === 'image') {
    if (media === 0) return 'empty';
    return media >= expectedImages(master) ? 'ready' : 'drafted';
  }
  const words = (kind === 'video' ? piece.script : piece.body ?? piece.script) ?? '';
  if (!words.trim()) return 'empty';
  return media > 0 ? 'ready' : 'drafted';
}

/** What the card says about itself. Short: it sits under the label on a phone. */
export function cardStateLabel(master: string, state: CardState): string {
  const kind = masterKind(master as MasterAsset);
  if (state === 'ready') return 'ready';
  if (kind === 'image') {
    const n = expectedImages(master);
    return state === 'empty'
      ? `no images yet, needs ${n}`
      : `part done, needs ${n}`;
  }
  if (state === 'empty') return kind === 'video' ? 'no script yet' : 'not written yet';
  return kind === 'video' ? 'script written, no video attached' : 'written, no image attached';
}

/** Every finished post a master has to serve, which for the video script is ten across four. */
export function outputsOnMaster(m: string): KitOutput[] {
  return CATALOGUE.filter((o) => o.master === m);
}

/**
 * The output a master serves ON ONE NETWORK, which is what a calendar entry actually is.
 *
 * outputForMaster is keyed by master alone and returns the FIRST entry, so a master serving
 * several networks gets one name for all of them: the LinkedIn video would be labelled "Reel" on
 * the week grid, because ig_reel_1 is first on 'shorts'. Position in the array cannot fix that,
 * because the label is keyed by master. This is the lookup the grid needs.
 */
export function outputForMasterOnNetwork(m: string, channel: string): KitOutput | undefined {
  return CATALOGUE.find((o) => o.master === m && o.network === channel) ?? outputForMaster(m);
}

/**
 * Which kind of slot a master's post belongs in.
 *
 * TWO VALUES, not the three masterKind carries: his split is video against text-and-images, and
 * every LinkedIn still post is a TEXT master with a mandatory image, so folding 'text' and 'image'
 * into one bucket is what makes the afternoon slot matchable at all.
 */
export function slotKindFor(m: string): SlotKind {
  return masterKind(m as MasterAsset) === 'video' ? 'video' : 'still';
}

/**
 * The body cap for ONE OUTPUT rather than for its master. A master serving several networks has
 * several caps, and bodyCapFor(master) returns whichever network happens to sort first: with the
 * LinkedIn video on 'shorts', trimming by master would cut every LinkedIn caption to Instagram's
 * 2,200 instead of LinkedIn's 3,000.
 */
export function capForOutput(o: KitOutput): { n: number; unit: CountUnit } | undefined {
  const a = o.artifact;
  if (a.kind === 'text' || a.kind === 'longform_text') return a.cap.v;
  return o.wrapper.captionMax?.v;
}

/* ------------------------------------------------------------------ resolving ticks */

/**
 * Persisted ticks to live output ids: expand retired aliases, drop unknowns, dedupe, and return
 * in CATALOGUE order so downstream order follows the screen regardless of how ids arrived.
 */
export function resolveTicks(ticks: string[], lane: NarrativeLane): string[] {
  const want = new Set<string>();
  for (const t of ticks) {
    const alias = aliasFor(t, lane);
    if (alias) {
      for (const id of alias) if (BY_ID.has(id)) want.add(id);
    } else if (BY_ID.has(t)) {
      want.add(t);
    }
  }
  return CATALOGUE.filter((o) => want.has(o.id)).map((o) => o.id);
}

export function defaultTicks(lane: NarrativeLane): string[] {
  const kind = streamKind(lane);
  return CATALOGUE.filter((o) => o.on.includes(kind)).map((o) => o.id);
}

/** Posts the ticks produce. EXACTLY the number of calendar entries Gate 5 will create. */
export function tickCount(ticks: string[], lane: NarrativeLane): number {
  return resolveTicks(ticks, lane).length;
}

/** Gate 5's unit. One of these is one calendar entry. */
export function outputsForTicks(ticks: string[], lane: NarrativeLane): KitOutput[] {
  const ids = new Set(resolveTicks(ticks, lane));
  return CATALOGUE.filter((o) => ids.has(o.id));
}

/* ------------------------------------------------------------------ Gate 3's screen */

export type KitRow = {
  key: string;
  network: Network;
  /** The tick ids this ONE checkbox owns. 1 for a post, 3 for a series. */
  ids: string[];
  label: string;
  sub: string;
  /** 'x3' for a series. ABSENT for a single post, because a column of "1"s is noise. */
  pill?: string;
  on: boolean;
  blocked?: string;
  /**
   * WHAT IT IS, on hover (D50). Marrs: "on the gate three page it would be great that when you
   * hovered over any of the options, it gives you an overview of what it is and why you would
   * use it."
   *
   * Both lines already existed on the output and neither reached a screen: `job` is what the
   * thing is for, and the first caveat is the evidence for reaching for it. The row stays two
   * lines and the reasoning arrives only when he asks for it.
   */
  what: string;
  /** Why you would pick it: the measured reason, or the reason it is off. */
  why: string;
  /** What it produces, in one phrase, e.g. "10 images at 1080 x 1350". */
  makes: string;
};

/**
 * The Gate 3 screen: twelve rows per lane, in network order, defaults on.
 *
 * A series collapses to one row because you never want hook 2 without hook 1, so it is one
 * decision. That is the only reason the catalogue can hold twenty outputs and the screen
 * still fit on a phone.
 */
/** One phrase for what an output physically produces, off its own artifact spec. */
function makesLine(o: KitOutput): string {
  const a = o.artifact;
  if (a.kind === 'video') return `video at ${a.frame.w} x ${a.frame.h}`;
  if (a.kind === 'pdf') return `a pdf, ${a.pages.v[0]} to ${a.pages.v[1]} pages at ${a.visual.w} x ${a.visual.h}`;
  if (a.kind === 'image_set') {
    return `${a.visual.images} image${a.visual.images === 1 ? '' : 's'} at ${a.visual.w} x ${a.visual.h}`;
  }
  if (a.kind === 'text') {
    return `${a.target.v[0]} to ${a.target.v[1]} characters, plus one ${a.visual.w} x ${a.visual.h} image`;
  }
  return `long form, plus one ${a.visual.w} x ${a.visual.h} cover`;
}

/** The hover copy for a row: what it is, and why you would reach for it. */
function describe(o: KitOutput): Pick<KitRow, 'what' | 'why' | 'makes'> {
  return {
    what: o.job,
    // A blocked output's most useful "why" is the reason it cannot be made yet.
    why: o.blocked ?? o.caveats?.[0] ?? '',
    makes: makesLine(o),
  };
}

export function kitRows(lane: NarrativeLane): KitRow[] {
  const kind = streamKind(lane);
  const rows: KitRow[] = [];
  const seenSeries = new Set<string>();
  for (const net of KIT_NETWORK_ORDER) {
    // Screen order, which is not array order: see KitOutput.row. Stable within equal numbers, so
    // an unnumbered output keeps its array position relative to its unnumbered neighbours.
    const inNetwork = CATALOGUE.map((o, ix) => ({ o, ix }))
      .filter((x) => x.o.network === net)
      .sort((a, mm) => (a.o.row ?? 99) - (mm.o.row ?? 99) || a.ix - mm.ix)
      .map((x) => x.o);
    for (const o of inNetwork) {
      if (!o.shown.includes(kind)) continue;
      if (o.series) {
        if (seenSeries.has(o.series)) continue;
        seenSeries.add(o.series);
        const members = CATALOGUE.filter(
          (x) => x.series === o.series && x.shown.includes(kind)
        );
        rows.push({
          key: o.series,
          network: net,
          ids: members.map((m) => m.id),
          label: o.label,
          sub: o.sub,
          pill: members.length > 1 ? `x${members.length}` : undefined,
          on: o.on.includes(kind),
          blocked: o.blocked,
          ...describe(o),
        });
      } else {
        rows.push({
          key: o.id,
          network: net,
          ids: [o.id],
          label: o.label,
          sub: o.sub,
          on: o.on.includes(kind),
          blocked: o.blocked,
          ...describe(o),
        });
      }
    }
  }
  return rows;
}

/* ------------------------------------------------------------------ Gate 4's plan */

export type MasterPlan = {
  master: MasterAsset;
  kind: 'text' | 'video' | 'image';
  /** Gate 4's card title. */
  label: string;
  /** The finished posts this one piece has to serve, in screen order. */
  outputs: KitOutput[];
  placements: { network: Network; count: number }[];
};

/**
 * The masters a set of ticks demands: one MasterPlan is one MarketingPiece and one Gate 4 card.
 *
 * Nine video outputs collapse into ONE shorts master with three placements, which is the
 * shoot-once-cut-many economy the kit exists to enforce. Text frames do NOT collapse: each has
 * its own master, so each gets its own piece with its own body and its own image, and every
 * placement count is 1, which is what makes Gate 5's `missing = count - have` guard exact
 * rather than merely approximate.
 */
export function plansForTicks(ticks: string[], lane: NarrativeLane): MasterPlan[] {
  const outputs = outputsForTicks(ticks, lane);
  const byMaster = new Map<MasterAsset, MasterPlan>();
  for (const o of outputs) {
    let plan = byMaster.get(o.master);
    if (!plan) {
      plan = {
        master: o.master,
        kind: masterKind(o.master),
        label: masterCardLabel(o.master),
        outputs: [],
        placements: [],
      };
      byMaster.set(o.master, plan);
    }
    plan.outputs.push(o);
    const existing = plan.placements.find((p) => p.network === o.network);
    if (existing) existing.count += 1;
    else plan.placements.push({ network: o.network, count: 1 });
  }
  /**
   * Placements follow the SCREEN order, not the array order.
   *
   * They used to be the same thing. They stopped being the same thing when the LinkedIn video was
   * put at the END of the shorts family, which it has to be because outputForMaster returns the
   * first entry on a master and its 3,000 character cap would otherwise govern Instagram's
   * captions. Sorting explicitly means array position can never again decide what an operator
   * reads, on this screen or in April's prompt.
   */
  const netRank = (n: Network) => {
    const i = KIT_NETWORK_ORDER.indexOf(n);
    return i === -1 ? 99 : i;
  };
  for (const plan of byMaster.values()) {
    plan.placements.sort((a, b) => netRank(a.network) - netRank(b.network));
    plan.outputs.sort((a, b) => netRank(a.network) - netRank(b.network));
  }
  return [...byMaster.values()].sort(
    (a, b) => (MASTER_META[a.master]?.rank ?? 99) - (MASTER_META[b.master]?.rank ?? 99)
  );
}

/* ------------------------------------------------------------------ counting, honestly */

/** Length in the platform's own unit. Bytes, UTF-16 runes and characters are three things. */
export function measure(text: string, unit: CountUnit): number {
  if (unit === 'byte') return new TextEncoder().encode(text).length;
  // 'rune' is TikTok's word for a UTF-16 code unit, which is exactly String.length. Counting
  // code points instead would under-count every emoji and pass a caption that is over the cap.
  return text.length;
}

/**
 * Trim to a cap in the right unit. Replaces the blanket `.slice(0, 4000)` the wave route used,
 * which was above LinkedIn's 3,000 and Instagram's and TikTok's 2,200.
 */
export function capCopy(text: string, cap: { n: number; unit: CountUnit }): string {
  if (measure(text, cap.unit) <= cap.n) return text;
  if (cap.unit !== 'byte') return text.slice(0, cap.n);
  // Bytes: slice by characters and walk back, because a byte slice can cut a surrogate pair or
  // a multi-byte sequence in half and produce a replacement character.
  let out = text.slice(0, cap.n);
  while (out.length > 0 && measure(out, 'byte') > cap.n) out = out.slice(0, -1);
  return out;
}

/** The cap that governs the post BODY for a master, if the spec states one. */
export function bodyCapFor(master: string): { n: number; unit: CountUnit } | undefined {
  const o = outputForMaster(master);
  if (!o) return undefined;
  const a = o.artifact;
  if (a.kind === 'text' || a.kind === 'longform_text') return a.cap.v;
  return o.wrapper.captionMax?.v;
}

/**
 * Operator-facing warnings on a finished body. Not validation: it never blocks a save, because
 * the operator's judgement outranks a rule of thumb. It exists so the two rules that are
 * genuinely load-bearing, the link placement and the em-dash ban, are caught by code rather
 * than by someone rereading their own copy.
 */
export function checkBody(master: string, text: string): string[] {
  const o = outputForMaster(master);
  if (!o) return [];
  const out: string[] = [];
  const body = text.trim();
  if (!body) return out;

  if (body.includes('—')) out.push('There is an em-dash in the copy. Use a comma, a period or a colon.');

  if (o.wrapper.link === 'first_comment' && /https?:\/\//i.test(body)) {
    out.push(
      'There is a link in the body. It belongs in the first comment: one body link costs about 18.8% of median reach, and you cannot have a link preview and an image in the same post.'
    );
  }

  const cap = bodyCapFor(master);
  if (cap && measure(body, cap.unit) > cap.n) {
    out.push(`Over the ${cap.n} ${cap.unit} limit for this network. It will be cut.`);
  }

  const a = o.artifact;
  if (a.kind === 'text') {
    const n = body.length;
    if (n < a.floor.v) {
      out.push(`Under ${a.floor.v} characters. That is the one length floor every study agrees on.`);
    } else if (n < a.target.v[0] || n > a.target.v[1]) {
      out.push(
        `${n} characters, outside the ${a.target.v[0]} to ${a.target.v[1]} band. That band is the overlap of two studies that disagree, so treat it as a hint rather than a rule.`
      );
    }
  }
  return out;
}

/* ------------------------------------------------------------------ what April is told */

function sizeLine(v: VisualSpec): string {
  const n = v.images === 1 ? 'One image' : `${v.images} images`;
  return `${n} at ${v.w} x ${v.h}: ${v.what}.`;
}

function units(n: number, unit: CountUnit): string {
  const word = unit === 'char' ? 'character' : unit === 'rune' ? 'UTF-16 unit' : 'byte';
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * The per-network wrapper facts, which is the part of a post that cannot be authored once.
 *
 * For a text post this is one network and one line. For the video script it is nine posts across
 * three networks, and the differences are real: only YouTube takes a 100-character title, a
 * BYTE-limited description and an uploadable 9:16 thumbnail; TikTok counts captions in UTF-16
 * units and cannot take a thumbnail file at all; Instagram counts characters and wants a
 * 420 x 654 cover. Printing one network's rules for all three is how a caption gets written to
 * the wrong limit.
 */
function wrapperLines(outputs: KitOutput[]): string[] {
  // Screen order, for the same reason plansForTicks sorts: array position is spoken for.
  const byNetwork = new Map<Network, KitOutput>();
  for (const net of KIT_NETWORK_ORDER) {
    const first = outputs.find((o) => o.network === net);
    if (first) byNetwork.set(net, first);
  }
  const many = byNetwork.size > 1;
  const lines: string[] = [];
  if (many) {
    lines.push(
      `ONE FILE, ${byNetwork.size} PLATFORMS. The same clean export is published natively to each, and the caption and cover are written per platform. Never carry another platform's watermark.`
    );
  }
  for (const [net, o] of byNetwork) {
    const w = o.wrapper;
    const bits: string[] = [];
    if (w.captionMax) bits.push(`caption at most ${units(w.captionMax.v.n, w.captionMax.v.unit)}`);
    if (w.captionFold) bits.push(`about ${w.captionFold.v} characters survive the fold`);
    if (w.titleMax) bits.push(`title at most ${units(w.titleMax.v.n, w.titleMax.v.unit)}`);
    if (w.descriptionMax) {
      bits.push(
        `description at most ${units(w.descriptionMax.v.n, w.descriptionMax.v.unit)}, which is NOT characters: emoji cost three or four each`
      );
    }
    if (w.cover.how === 'upload') bits.push(`cover uploaded at ${w.cover.w} x ${w.cover.h}`);
    if (w.cover.how === 'pick_frame') bits.push('cover picked from a frame, no file can be uploaded');
    if (w.hashtags?.v === 'off') {
      bits.push('NO hashtags: a 24 million post study measured 31.70% fewer views on posts carrying them');
    } else if (w.hashtags?.v === 'up_to_3') {
      bits.push('at most three hashtags');
    }
    if (w.link === 'first_comment') {
      bits.push('NO LINK IN THE BODY: it goes in the first comment, so do not write one into the copy');
    } else if (w.link === 'caption_and_first_comment') {
      bits.push('the CTA in the caption and the link in the first comment, never inside the file');
    }
    if (bits.length === 0) continue;
    lines.push(many ? `${net}: ${bits.join('; ')}.` : `${bits.join('. ')}.`);
  }
  return lines;
}

/**
 * THE OUTPUT SPEC, AS AN INSTRUCTION. Read by draft.ts and injected into April's system prompt.
 *
 * This function is the whole reason the catalogue is worth building. Without it the typed frames
 * are labels on a screen: every LinkedIn frame writes format 'linkedin_text', whose registry
 * default said "150 to 250 words", so a contrarian post and a numbered list arrived at the model
 * as the same instruction at a length the spec's own data contradicts. Three separate reviews
 * called that out as the condition on the whole design, and they were right.
 *
 * Note what it refuses to say. There is no target duration for any video, because none of the
 * three platforms publishes one. And doNotAssert is printed, so the gaps in the research travel
 * with the numbers instead of being quietly dropped on the way to the model.
 */
export function promptFragment(master: string): string | undefined {
  const o = outputForMaster(master);
  if (!o) return undefined;
  /**
   * BLOCKED SIBLINGS ARE LEFT OUT (D47). The carousel master serves the Instagram swipe and the
   * LinkedIn document, and the document is blocked and planned nowhere, so listing it here told
   * April she was writing for two platforms and briefed her to a caption cap for a post that is
   * never made. Brief her on what is actually being produced.
   */
  const all = outputsOnMaster(master);
  const siblings = all.some((o) => !o.blocked) ? all.filter((o) => !o.blocked) : all;
  const a = o.artifact;
  const lines: string[] = [];

  // Screen order here as well, so the header, the wrapper lines and the Gate 3 rows all read the
  // networks in one order rather than three.
  const nets = KIT_NETWORK_ORDER.filter((n) => siblings.some((x) => x.network === n));
  lines.push(
    nets.length > 1
      ? `THE FINISHED POSTS: ${siblings.length} of them, on ${nets.join(', ')}. ${o.job}`
      : `THE FINISHED POST: ${o.postLabel} on ${o.network}. ${o.job}`
  );

  if (a.kind === 'text') {
    lines.push(
      `LENGTH: aim for ${a.target.v[0]} to ${a.target.v[1]} characters, never under ${a.floor.v}, hard cap ${a.cap.v.n}.`
    );
    if (a.fold) {
      lines.push(
        `THE FOLD: about ${a.fold.v} characters survive before "see more" on mobile, and line breaks count against it. The first line has to earn the click.`
      );
    }
  } else if (a.kind === 'longform_text') {
    lines.push(`LENGTH: long form. The platform cap is ${a.cap.v.n} characters, which you will not reach.`);
  } else if (a.kind === 'pdf') {
    lines.push(
      `SHAPE: ${a.pages.v[0]} to ${a.pages.v[1]} pages, under ${a.maxWordsPerPage.v} words each. Every page must land on its own: animation flattens to a still and a link inside the file is unreliable, so a page that needs the next one to make sense does not work.`
    );
  } else if (a.kind === 'image_set') {
    lines.push(`SHAPE: ${sizeLine(a.visual)}`);
  } else if (a.kind === 'video') {
    lines.push(
      'NO TARGET DURATION. Not one of these platforms publishes an optimal length, so write to the argument and not to a clock.'
    );
    if (a.safeArea) {
      lines.push(
        `ON-SCREEN TEXT must sit inside ${a.safeArea.w} x ${a.safeArea.h} at offset ${a.safeArea.x}, ${a.safeArea.y} on a ${a.frame.w} x ${a.frame.h} frame. Outside that, platform UI covers it on at least one network.`
      );
    }
  }

  if (a.kind !== 'video' && a.kind !== 'image_set') lines.push(`THE IMAGE: ${sizeLine(a.visual)}`);

  lines.push(...wrapperLines(siblings));

  if (o.postType === 'contrarian') {
    lines.push('SHAPE: state the belief, then break it. If the source carries no real position, say so rather than manufacturing a disagreement.');
  }
  if (o.postType === 'listicle') {
    lines.push('SHAPE: numbered rules. Number them, and make every one of them do work.');
  }
  if (o.postType === 'hard_moment') {
    lines.push('SHAPE: one cost actually paid, told straight, in first person.');
  }
  if (o.postType === 'field_report') {
    lines.push('SHAPE: the pattern across the work, with no client named and nothing that needs sign off.');
  }
  if (a.kind === 'text' || a.kind === 'longform_text') {
    lines.push('CLOSE ON A QUESTION. Posts that include one get 77% more comments.');
  }
  /**
   * Every sibling's gaps, deduped. The TikTok caption-truncation gap and the five-year-old
   * ad-data warning live on tt_1, not on ig_reel_1, so reading only the first output would drop
   * exactly the warnings that apply to the platform whose data is weakest.
   */
  const gaps = [...new Set(siblings.flatMap((x) => x.doNotAssert ?? []))];
  if (gaps.length > 0) {
    lines.push(
      `DO NOT STATE OR IMPLY ANY OF THESE. We do not know them, and a confident number here would be invented:\n${gaps
        .map((d) => `- ${d}`)
        .join('\n')}`
    );
  }
  return lines.join('\n');
}

/**
 * Invariants a type cannot express, returned as failures rather than thrown.
 *
 * Called by a test, NEVER at import time: a throw here would blank the Gate 3 screen in the
 * browser over a data typo, which is a worse failure than the typo.
 */
/**
 * DOES EVERY KIND THIS LANE PRODUCES HAVE A SLOT THAT IS FOR IT?
 *
 * This is the check that would have caught the whole bug class before it shipped. LinkedIn's
 * morning slot was going to prefer video while the catalogue produced no LinkedIn video at all, and
 * nothing anywhere would have said so: the week would simply have been half as full as he asked
 * for, and he would have found out by looking at it.
 *
 * WARNINGS, not failures. Under a preference model a slot with no supply is legal, it just means
 * the fallback carries that slot, and a preference nothing matches is a hint worth printing rather
 * than a broken build. Returns lines, so the caller decides what to do with them.
 *
 * Takes the preference lookup as an argument rather than importing it, because this file is
 * client-safe and channel-schedule.ts is not.
 */
export function slotSupplyProblems(
  lane: NarrativeLane,
  prefersByNetwork: (n: Network) => SlotPrefers[]
): string[] {
  const out: string[] = [];
  const outputs = outputsForTicks(defaultTicks(lane), lane);
  for (const network of KIT_NETWORK_ORDER) {
    const mine = outputs.filter((o) => o.network === network);
    if (mine.length === 0) continue;
    const supplied = new Set(mine.map((o) => slotKindFor(o.master)));
    const wanted = prefersByNetwork(network);
    for (const kind of new Set(wanted)) {
      if (kind === 'any') continue;
      if (!supplied.has(kind)) {
        out.push(
          `${lane}: a ${network} slot prefers ${kind} and the kit produces no ${kind} post on ${network}. That slot will be carried by the fallback.`
        );
      }
    }
    for (const kind of supplied) {
      if (!wanted.includes(kind) && !wanted.includes('any')) {
        out.push(
          `${lane}: the kit produces a ${kind} post on ${network} and no ${network} slot prefers ${kind}.`
        );
      }
    }
  }
  return out;
}

export function catalogueProblems(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const o of CATALOGUE) {
    if (seen.has(o.id)) out.push(`duplicate output id: ${o.id}`);
    seen.add(o.id);

    // Rule 2: every post carries an image.
    const v =
      o.artifact.kind === 'image_set' || o.artifact.kind === 'video'
        ? o.artifact.visual
        : o.artifact.visual;
    if (!v || v.images < 1) out.push(`${o.id} has no image`);

    for (const kind of o.on) {
      if (!o.shown.includes(kind)) out.push(`${o.id} defaults on for ${kind} but is not shown there`);
    }
    // A catalogue that offers what it cannot deliver is lying to the operator.
    if (o.blocked && o.on.length > 0) out.push(`${o.id} is blocked but defaults on`);

    if (!MASTER_META[o.master]) out.push(`${o.id} has an unknown master: ${o.master}`);

    for (const s of [o.label, o.sub, o.postLabel]) {
      if (s.includes('—')) out.push(`${o.id} has an em-dash in operator copy: ${s}`);
    }
    if (o.series && !CATALOGUE.some((x) => x !== o && x.series === o.series)) {
      out.push(`${o.id} is a series of one`);
    }
  }

  // Every retired id must still resolve, or a saved narrative loses those posts silently.
  // Every stream, not just the original two: a teammate added to STREAMS must not be the
  // one lane whose defaults resolve to nothing.
  for (const lane of STREAM_IDS) {
    for (const id of [...Object.keys(V1_ALIASES), 'li_posts']) {
      const targets = aliasFor(id, lane) ?? [];
      if (targets.length === 0) out.push(`alias ${id} resolves to nothing on ${lane}`);
      for (const t of targets) if (!BY_ID.has(t)) out.push(`alias ${id} points at a dead id: ${t}`);
    }
    // Every master a default kit demands must have a card label and a prompt fragment, or
    // Gate 4 shows an unnamed card and April gets no spec.
    for (const plan of plansForTicks(defaultTicks(lane), lane)) {
      if (!promptFragment(plan.master)) out.push(`no prompt fragment for master ${plan.master}`);
    }
  }
  return out;
}
