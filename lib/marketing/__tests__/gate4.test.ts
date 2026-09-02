/**
 * GATE 4: the slide plan, the card state, and the regressions around them.
 *
 * Run with `npm run test:marketing`. It exists in the repo rather than in a scratch file
 * because the console has no test runner and every suite written outside the repo has been
 * lost between sessions, which is exactly the wrong property for the week the flow is being
 * walked end to end for the first time.
 */

import {
  parseSlidePlan,
  serialiseSlidePlan,
  mediaFromPlan,
  slideCountFor,
  nextUnapproved,
  runPosition,
  approvedCount,
  MAX_SLIDES,
  SLIDE_W,
  SLIDE_H,
  type SlidePlan,
} from '../slide-plan';
import { TEMPLATES, LEGACY_TEMPLATE } from '../slide-plan';
import {
  TEMPLATE_SPECS,
  DEFAULT_TEMPLATE,
  templateSpec,
  generationsFor,
  switchKind,
} from '../slide-templates';
import { SoulSize, BatchSize } from '@higgsfield/client';
import { SOUL_SIZES } from '../higgsfield-models';
import { HERO_BATCH, HERO_SIZE, HERO_W, HERO_H, HERO_ASPECT } from '../hero';
import { stripMarkdownEmphasis } from '../../plain-copy';
import { parseLine } from '../text-overlay';
import { cleanArticle } from '../article-draft';
import { foldRule, foldCopy, copyLength } from '../post-preview';
import { timezoneForEntry } from '../posting-schedule';
import {
  nextOpenSlots,
  laneTimezone,
  defaultChannelSchedule,
  normalizeChannelSchedule,
} from '../channel-schedule';
import { IMAGE_MODELS, providerOf, imageModelById, DEFAULT_IMAGE_MODEL } from '../higgsfield-models';
import { daysBetween, todayIn, queueDepthNote, DEEP_DAYS } from '../queue-depth';
import { finishedMediaPieceFor, FINISHED_MEDIA_FORMAT } from '../finished-media';
import { isValidPiece } from '../piece-store';
import { youtubeTitleFrom, YOUTUBE_TITLE_MAX } from '../metricool-client';
import { networkSettings } from '../analytics-probe';
import { resolvePostTime } from '../when-to-post';
import { youtubeTypeToken, youtubeTypeLabel, isYoutubeVideoType } from '../youtube-type';
import { kindOf, formatById } from '../output-plan';
import { nearestSoulSize, aspectSentence, frameFor } from '../image-generate';
import { heldByOther, parseHeld, WAVE_LOCK_MS } from '../wave-lock';
import {
  checkUpload,
  labelFromFilename,
  UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
} from '../media-upload';
import {
  mockAnalytics,
  compactNumber,
  signedPct,
  sparklinePoints,
} from '../analytics-mock';
import { joinReport, harvestIds } from '../analytics-probe';
import { llmErrorText } from '../../llm/error-text';
import { laneVoice } from '../article-draft';
import { networksFromProfile, networkAvailable } from '../connected-networks';
import { parseProposal } from '../slide-propose';
import {
  cardState,
  cardStateLabel,
  expectedImages,
  outputForMaster,
  outputForMasterOnNetwork,
  promptFragment,
  bodyCapFor,
  defaultTicks,
  tickCount,
  kitRows,
  catalogueProblems,
  plansForTicks,
  masterCardLabel,
  masterDetail,
  outputById,
} from '../kit';
import { prezieFilingKey } from '../prezie-store';
import { STREAM_IDS } from '../streams';

let pass = 0;
let fail = 0;
const ok = (n: string, c: boolean, x = '') => {
  if (c) pass++;
  else {
    fail++;
    console.log(`FAIL ${n} ${x}`);
  }
};
const eq = (n: string, got: unknown, want: unknown) => {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) pass++;
  else {
    fail++;
    console.log(`FAIL ${n}\n  got  ${a}\n  want ${b}`);
  }
};

/* ------------------------------------------------------------ how many slides */

eq('a carousel wants ten', slideCountFor({ master: 'carousel' }), MAX_SLIDES);
eq('a card wants one', slideCountFor({ master: 'images' }), 1);
eq('the format decides when the master is missing', slideCountFor({ format: 'single_image' }), 1);
eq('and defaults to a set otherwise', slideCountFor({ format: 'pdf_carousel' }), MAX_SLIDES);
eq('one slide size for the whole set', [SLIDE_W, SLIDE_H], [1080, 1350]);

/* ------------------------------------------------------------ April's proposal */

const proposal = JSON.stringify({
  world: 'cold morning light on raw concrete, muted greens',
  caption: 'a caption',
  slides: Array.from({ length: 10 }, (_, i) => ({
    role: 'body',
    headline: `Slide ${i + 1} says *this*`,
    note: 'stands on the article',
    prompt: 'a photograph of something',
  })),
});
{
  const p = parseProposal(proposal, 10);
  eq('ten slides parsed', p.slides.length, 10);
  eq('numbered from one, in order', p.slides.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  // Roles are forced by POSITION, not taken from the model: it returned 'body' for all ten.
  eq('slide one is the cover', p.slides[0].role, 'cover');
  eq('the last one closes', p.slides[9].role, 'close');
  eq('the middle is body', p.slides[4].role, 'body');
  // House placement, so the screen never asks.
  eq('the cover shouts from the centre', [p.slides[0].position, p.slides[0].size], ['centre', 'large']);
  eq('body slides sit low', [p.slides[4].position, p.slides[4].size], ['lower', 'medium']);
  ok('the world survives', p.world.includes('concrete'));
  ok('nothing is approved yet', p.slides.every((s) => !s.approved));
  ok('and nothing has a picture yet', p.slides.every((s) => !s.url && !s.media_id));
}
{
  // A one-card piece must not be given a cover-and-close structure.
  const p = parseProposal(proposal, 1);
  eq('a card is one slide', p.slides.length, 1);
  eq('and it is the cover', p.slides[0].role, 'cover');
}
// Tolerant on shape, strict on emptiness.
ok('a fenced response still parses', parseProposal('```json\n' + proposal + '\n```', 10).slides.length === 10);
ok('prose around the object is stripped', parseProposal('Here you go:\n' + proposal, 10).slides.length === 10);
for (const bad of ['', 'not json', '{}', '{"slides":[]}', '{"slides":[{"headline":"","prompt":""}]}']) {
  let threw = false;
  try {
    parseProposal(bad, 10);
  } catch {
    threw = true;
  }
  ok(`a useless response fails loudly: ${JSON.stringify(bad).slice(0, 24)}`, threw);
}
// The em-dash ban reaches the slides, not just the prose.
ok(
  'em-dashes are stripped from a headline',
  !parseProposal(
    JSON.stringify({ world: 'w', caption: 'c', slides: [{ headline: 'a — b', prompt: 'p' }] }),
    1
  ).slides[0].headline.includes('—')
);

/* ---- the shapes that used to fail with no log line at all (D49) ---- */

// A wrapper object. In JSON mode a model will happily nest its answer, and `o.slides` alone
// read that as zero slides and threw.
for (const wrapped of [
  '{"plan":{"world":"w","caption":"c","slides":[{"headline":"h","prompt":"p"}]}}',
  '{"result":{"slides":[{"headline":"h","prompt":"p"}]}}',
  '{"world":"w","items":[{"headline":"h","prompt":"p"}]}',
]) {
  const p = parseProposal(wrapped, 1);
  eq(`a wrapped response still parses: ${wrapped.slice(0, 22)}`, p.slides.length, 1);
}

// Reasoning prose in front of the object moved the brace span, so the slice was not JSON.
ok(
  'a leading brace in prose does not break it',
  parseProposal('Thinking: the set {should} open on a claim.\n' + proposal, 10).slides.length === 10
);
// And anything after it used to move the end.
ok(
  'trailing prose does not break it',
  parseProposal(proposal + '\n\nThat should work well.', 10).slides.length === 10
);

// SALVAGE: a truncated response loses the tail, so the complete slides at the head survive.
{
  const full = JSON.stringify({
    world: 'w',
    caption: 'c',
    slides: Array.from({ length: 10 }, (_, i) => ({
      headline: `Slide ${i + 1}`,
      note: 'n',
      prompt: 'a photograph',
    })),
  });
  const cut = full.slice(0, Math.floor(full.length * 0.62));
  const p = parseProposal(cut, 10);
  ok('a truncated response salvages what is there', p.slides.length >= 3, `got ${p.slides.length}`);
  ok('and they are numbered from one', p.slides[0].n === 1);
  ok('and the first one is real', p.slides[0].headline.startsWith('Slide 1'));
}

// A brace inside a string must not unbalance the scan.
ok(
  'a brace inside an image prompt is safe',
  parseProposal(
    '{"world":"w","caption":"c","slides":[{"headline":"h","prompt":"a sign reading { open }"}]}',
    1
  ).slides[0].prompt.includes('{'),
);

// The key names a model reaches for when it forgets ours.
{
  const p = parseProposal('{"slides":[{"text":"the words","image":"a photo"}]}', 1);
  eq('text becomes the headline', p.slides[0].headline, 'the words');
  eq('image becomes the prompt', p.slides[0].prompt, 'a photo');
}

/* ------------------------------------------------------------ the stored plan */

const madeSlide = (n: number, approved: boolean) => ({
  n,
  role: n === 1 ? 'cover' : 'body',
  headline: `h${n}`,
  note: '',
  prompt: 'p',
  position: 'centre',
  size: 'medium',
  baseColor: '#ffffff',
  highlightColor: '#69fccb',
  bg_url: `https://x/bg${n}.png`,
  url: `https://x/s${n}.png`,
  media_id: `m${n}`,
  approved,
});
const stored: SlidePlan = parseSlidePlan(
  JSON.stringify({
    version: 1,
    world: 'w',
    caption: 'c',
    slides: [madeSlide(1, true), madeSlide(2, true), madeSlide(3, false)],
  })
)!;
ok('a stored plan round-trips', !!stored);
eq('three slides', stored.slides.length, 3);
eq('two approved', approvedCount(stored), 2);

/* THE ORDER GUARANTEE, which is the whole definition of done. */
eq('media is the approved slides in slide order', mediaFromPlan(stored), ['m1', 'm2']);
{
  // Out-of-order storage must still produce post order, because Metricool posts the array
  // verbatim and slide order IS the content.
  const shuffled = parseSlidePlan(
    JSON.stringify({ slides: [madeSlide(3, true), madeSlide(1, true), madeSlide(2, true)] })
  )!;
  eq('order comes from n, never from array position', mediaFromPlan(shuffled), ['m1', 'm2', 'm3']);
}
eq('no plan means no media', mediaFromPlan(null), []);
{
  // A hand-edited plan must not be able to claim a slide is done with nothing behind it.
  const lying = parseSlidePlan(
    JSON.stringify({ slides: [{ n: 1, headline: 'h', approved: true }] })
  )!;
  ok('approved needs a file and an id', !lying.slides[0].approved);
  eq('so it ships nothing', mediaFromPlan(lying), []);
}
{
  // Never more than the API ceiling, whatever is on disk.
  const twelve = parseSlidePlan(
    JSON.stringify({ slides: Array.from({ length: 12 }, (_, i) => madeSlide(i + 1, true)) })
  )!;
  ok(`never more than ${MAX_SLIDES} slides`, twelve.slides.length <= MAX_SLIDES);
  ok(`never more than ${MAX_SLIDES} images`, mediaFromPlan(twelve).length <= MAX_SLIDES);
}
// Garbage reads as "no plan yet" so the screen offers to write one.
for (const bad of [undefined, null, '', 'not json', '[]', '{}', '{"slides":"nope"}', '{"slides":[]}']) {
  eq(`unusable stored plan reads as none: ${JSON.stringify(bad)}`, parseSlidePlan(bad as string), null);
}
eq('serialise round-trips', parseSlidePlan(serialiseSlidePlan(stored))!.slides.length, 3);

/* ------------------------------------------------------------ where the run is */

eq('the run sits on the first unapproved slide', runPosition(stored), 3);
eq('next after 1 is the first unapproved after it', nextUnapproved(stored, 1), 3);
eq('it wraps rather than dead-ending', nextUnapproved(stored, 3), 3);
{
  const done = parseSlidePlan(
    JSON.stringify({ slides: [madeSlide(1, true), madeSlide(2, true)] })
  )!;
  eq('a finished run has nothing next', nextUnapproved(done, 1), null);
  eq('and rests on the last slide', runPosition(done), 2);
}

/* ------------------------------------------------------------ the Gate 4 card state */

eq('an untouched carousel is empty', cardState('carousel', {}), 'empty');
eq('one image of ten is part done', cardState('carousel', { media: ['a'] }), 'drafted');
eq(
  'ten is ready',
  cardState('carousel', { media: Array.from({ length: 10 }, (_, i) => `m${i}`) }),
  'ready'
);
eq('one image is a whole card', cardState('images', { media: ['a'] }), 'ready');
eq('a scriptless video is empty', cardState('shorts', { script: '' }), 'empty');
eq('a script with no film is drafted', cardState('shorts', { script: 'words' }), 'drafted');
eq('script plus film is ready', cardState('shorts', { script: 'words', media: ['v'] }), 'ready');
eq('an unwritten post is empty', cardState('texts', { body: '  ' }), 'empty');
eq('written with no image is drafted', cardState('texts', { body: 'words' }), 'drafted');
eq('written with an image is ready', cardState('texts', { body: 'words', media: ['i'] }), 'ready');
eq('ten expected on a carousel', expectedImages('carousel'), 10);
eq('one on a card', expectedImages('images'), 1);
ok('the label says what is missing', cardStateLabel('carousel', 'empty').includes('10'));
ok('and says ready when it is', cardStateLabel('texts', 'ready') === 'ready');
for (const m of ['carousel', 'images', 'shorts', 'texts', 'article']) {
  for (const st of ['empty', 'drafted', 'ready'] as const) {
    ok(`${m}/${st} label has no em-dash`, !cardStateLabel(m, st).includes('—'));
  }
}

/* ---- ONE NAME PER THING, ACROSS ALL THREE GATES (D54) ---- */

// Gate 3's row label, Gate 4's card name and Gate 5's chip were three separate vocabularies and
// the single image was the worst: "Image", "Quote card", "Card".
for (const lane of STREAM_IDS) {
  const rows = kitRows(lane);
  for (const plan of plansForTicks(defaultTicks(lane), lane)) {
    const g3 = rows
      .filter((r) => r.ids.some((id) => outputById(id)!.master === plan.master))
      .map((r) => r.label);
    const g4 = masterCardLabel(plan.master);
    const chips = [...new Set(plan.outputs.map((o) => o.postLabel))];

    // The Gate 4 name has to be one of the Gate 3 rows for that master.
    ok(`${lane}/${plan.master}: gate 4 name is a gate 3 name`, g3.includes(g4), `${g4} not in ${g3}`);

    /**
     * And so does every chip, with ONE deliberate exception: a video is a Reel on Instagram, a
     * Short on YouTube and a TikTok on TikTok. That is the platform's own word, not our
     * inconsistency, so a chip may be the singular of a Gate 3 row. "Card" was not Instagram's
     * word for anything, which is why it had to go.
     */
    const singularOf = (x: string) => (x.endsWith('s') ? x.slice(0, -1) : x);
    for (const chip of chips) {
      const known = g3.some((l) => l === chip || singularOf(l) === chip) || chip === g4;
      ok(`${lane}/${plan.master}: chip "${chip}" is a known name`, known, `rows ${g3}`);
    }
  }
}
// The one that started it.
eq('the single image is Image everywhere', masterCardLabel('images'), 'Image');
eq('and its chip agrees', outputById('ig_card')!.postLabel, 'Image');
eq('and so does its gate 3 row', outputById('ig_card')!.label, 'Image');
// The detail line says HOW, so the name is free to say WHAT.
for (const m of ['shorts', 'carousel', 'images', 'article', 'texts']) {
  ok(`${m} has a detail line`, masterDetail(m).length > 0);
  ok(`${m} detail is not its name`, masterDetail(m) !== masterCardLabel(m));
  ok(`${m} detail has no em-dash`, !masterDetail(m).includes('—'));
}

/* ------------------------------------------------------------ regressions */

// April was briefed to the LinkedIn PDF for a set of Instagram slides, because li_car sorts
// before ig_car and li_car is blocked.
eq('the carousel briefs the instagram swipe', outputForMaster('carousel')!.id, 'ig_car');
{
  const frag = promptFragment('carousel')!;
  ok('the brief says ten slides', frag.includes('10 images at 1080 x 1350'));
  ok('and never mentions pdf pages', !/\d+ to \d+ pages/.test(frag));
  ok('and does not claim two platforms', !frag.includes('2 PLATFORMS'));
}
eq('and the caption cap is instagram', bodyCapFor('carousel'), { n: 2200, unit: 'char' });
// A master serving several networks must be named per network, not by its first entry.
eq('linkedin video is called Video', outputForMasterOnNetwork('shorts', 'linkedin')!.postLabel, 'Video');
eq('instagram is still a Reel', outputForMasterOnNetwork('shorts', 'instagram')!.postLabel, 'Reel');
// A Gates piece has no concept, and used to share one prezie bucket with every narrative.
eq(
  'a narrative gets its own prezie bucket',
  prezieFilingKey({ narrative_ref: '11111111-2222-3333-4444-555555555555' }),
  'n-11111111-2222-3333-4444-555555555555'
);
eq(
  'a concept still wins when there is one',
  prezieFilingKey({ concept_ref: 'pam/concept-bank/x/core-concept-force-multiplier.md' }),
  'force-multiplier'
);
eq('and nothing identifiable stays unfiled', prezieFilingKey({}), '_unfiled');
ok('a junk narrative ref cannot forge a bucket', prezieFilingKey({ narrative_ref: '../etc' }) === '_unfiled');

// The catalogue still holds, on every lane.
eq('the catalogue is clean', catalogueProblems(), []);
for (const lane of STREAM_IDS) {
  eq(`${lane}: 12 rows`, kitRows(lane).length, 12);
  eq(`${lane}: 16 default posts`, tickCount(defaultTicks(lane), lane), 16);
}

/* ------------------------------------------------------------------ D55: the three looks */

/**
 * All three templates existed and only one was reachable, so these lock the two things a
 * picker cannot be trusted to get right by eye: that the three specs and the three ids are the
 * same three, and that changing the look asks first exactly when it is about to cost the words.
 */
eq('three looks, no more', TEMPLATE_SPECS.length, TEMPLATES.length);
for (const t of TEMPLATES) {
  eq(`${t}: has a spec`, templateSpec(t).id, t);
  ok(`${t}: the spec has a name and a blurb`, Boolean(templateSpec(t).name && templateSpec(t).blurb));
}
ok('the default look is a real one', (TEMPLATES as string[]).includes(DEFAULT_TEMPLATE));
ok('and it is not the legacy fallback', DEFAULT_TEMPLATE !== LEGACY_TEMPLATE);

// The cost line on the picker. A plate spends nothing, a full frame spends one per slide, and a
// split spends half, which is the whole reason it is the default.
eq('a plate generates nothing', generationsFor('plate', 10), 0);
eq('a full frame generates every slide', generationsFor('full', 10), 10);
eq('a split generates half', generationsFor('split', 10), 5);
eq('and a single card is one', generationsFor('full', 1), 1);

const planOf = (template: 'plate' | 'split' | 'full', prompts: string[]): SlidePlan => ({
  version: 1,
  template,
  accent: '#69fccb',
  kicker: 'EMERGENT AI',
  world: '',
  caption: '',
  slides: prompts.map((prompt, i) => ({
    n: i + 1,
    role: i === 0 ? ('cover' as const) : ('body' as const),
    headline: `line ${i + 1}`,
    note: '',
    prompt,
    position: 'lower' as const,
    size: 'medium' as const,
    baseColor: '#ffffff',
    highlightColor: '#69fccb',
  })),
});

const NONE = ['', '', '', ''];
const HALF = ['a street at dusk', '', 'a hand on a switch', ''];
const ALL = ['a', 'b', 'c', 'd'];

eq('the look it is already in costs nothing', switchKind('plate', planOf('plate', NONE)), 'same');
// A plate set has no photo subjects in it, so there is nothing for either photo look to draw.
eq('plate to split rewrites', switchKind('split', planOf('plate', NONE)), 'rewrite');
eq('plate to full rewrites', switchKind('full', planOf('plate', NONE)), 'rewrite');
// A plate ignores photographs, so it can always be reached for free.
eq('full to plate is free', switchKind('plate', planOf('full', ALL)), 'reset');
eq('split to plate is free', switchKind('plate', planOf('split', HALF)), 'reset');
// A full frame generates for every slide, so half a set of subjects is not enough.
eq('split to full rewrites on a half set', switchKind('full', planOf('split', HALF)), 'rewrite');
eq('split to full is free when every slide has one', switchKind('full', planOf('split', ALL)), 'reset');
// A split slide with no prompt is a deliberate type-only slide, so one subject anywhere is enough.
eq('full to split is free', switchKind('split', planOf('full', ALL)), 'reset');
eq('and one subject is enough for a split', switchKind('split', planOf('plate', HALF)), 'reset');

// The template survives a round trip, or a switch would be forgotten on the next reload.
for (const t of TEMPLATES) {
  const back = parseSlidePlan(serialiseSlidePlan(planOf(t, ALL)));
  eq(`${t}: survives the round trip`, back?.template, t);
  eq(`${t}: the kicker rides with it`, back?.kicker, 'EMERGENT AI');
}
eq(
  'a plan written before templates existed reads as the full frame it was drawn as',
  parseSlidePlan(JSON.stringify({ version: 1, slides: [{ n: 1, headline: 'x' }] }))?.template,
  LEGACY_TEMPLATE
);

/* ------------------------------------------------------------------ D56: the hero batch */

/**
 * THE ONE ASSERTION THAT CANNOT BE MADE BY READING. A width_and_height Soul does not recognise
 * is a 400 from Higgsfield at generation time, minutes into a wait, and nothing upstream of that
 * catches it: it typechecks, it lints, it deploys. So the size is checked against the SDK's own
 * enum rather than against a list in this repo, which is exactly the list that was wrong.
 */
ok('the hero size is a real Soul size', Object.values(SoulSize).includes(HERO_SIZE as never));
for (const sz of SOUL_SIZES) {
  ok(`${sz.id}: offered and real`, Object.values(SoulSize).includes(sz.id as never));
}

// 4:3, exactly, and the declared dimensions agree with the string sent to the model. A crop
// would mean the photograph he picked is not the photograph he gets.
eq('the hero size and its dimensions agree', HERO_SIZE, `${HERO_W}x${HERO_H}`);
eq('and it is exactly 4:3', HERO_W / HERO_H, 4 / 3);
eq('the css aspect says the same thing', HERO_ASPECT, '4 / 3');

/**
 * Four, and the grid is built for four. Same reasoning as the size: Soul's BatchSize is exactly
 * {SINGLE: 1, QUAD: 4}, so 4 is not a number that can be tuned to taste. A 2 or a 6 here is a
 * 400 from Higgsfield minutes into a wait, and it typechecks on the way there.
 */
eq('four candidates', HERO_BATCH, 4);
ok('more than one, or there is nothing to choose from', HERO_BATCH > 1);
ok('the batch is one Soul accepts', Object.values(BatchSize).includes(HERO_BATCH as never));
eq('and Soul offers no other multi option', Object.values(BatchSize).sort().join(','), '1,4');

/* ------------------------------------------------------------------ D57: plain post copy */

/**
 * Marrs: "in the written pieces, don't use any star symbols for bolding because that doesn't
 * work here."
 *
 * The risk in a stripper like this is not that it misses a marker, it is that it eats a
 * character somebody meant. So the cases that must survive untouched are tested harder than
 * the cases that must change.
 */
eq('a bold title loses its asterisks', stripMarkdownEmphasis('**The Future nobody Can See**'), 'The Future nobody Can See');
eq('bold inside a line', stripMarkdownEmphasis('it was **already** broken'), 'it was already broken');
eq('italics too', stripMarkdownEmphasis('it was *already* broken'), 'it was already broken');
eq('bold italic', stripMarkdownEmphasis('***both***'), 'both');
eq('underscore bold', stripMarkdownEmphasis('__loud__'), 'loud');
eq('underscore italic', stripMarkdownEmphasis('_quiet_'), 'quiet');
eq('a heading keeps its words', stripMarkdownEmphasis('## The point'), 'The point');
eq('and every level of heading', stripMarkdownEmphasis('###### deep'), 'deep');
eq(
  'a heading mid document',
  stripMarkdownEmphasis('one\n\n### two\n\nthree'),
  'one\n\ntwo\n\nthree'
);

// THE THINGS THAT MUST NOT CHANGE.
eq('plain copy is untouched', stripMarkdownEmphasis('Strip the process back first.'), 'Strip the process back first.');
eq('arithmetic survives', stripMarkdownEmphasis('5 * 3 * 2'), '5 * 3 * 2');
eq('a snake_case name survives', stripMarkdownEmphasis('read hero_url from the store'), 'read hero_url from the store');
eq('two snake names in a line survive', stripMarkdownEmphasis('hero_url and hero_media_id'), 'hero_url and hero_media_id');
eq(
  'a bullet list is not emphasis',
  stripMarkdownEmphasis('* one\n* two\n* three'),
  '* one\n* two\n* three'
);
eq('a lone asterisk survives', stripMarkdownEmphasis('the fallback slot (marked *)'), 'the fallback slot (marked *)');
eq('a hash that is not a heading survives', stripMarkdownEmphasis('ranked #1 in the list'), 'ranked #1 in the list');
eq('a hashtag survives', stripMarkdownEmphasis('#nofilter'), '#nofilter');
eq('empty in, empty out', stripMarkdownEmphasis(''), '');

/**
 * THE ONE THAT WOULD HAVE BEEN A REGRESSION. A slide headline marks its accent phrase with
 * single asterisks, so this stripper must never be pointed at slide copy. It is not: slide text
 * comes back through slide-propose's own cleanField. This asserts the grammar still parses, so
 * if anyone ever does wire the stripper in there, this is the test that says why not.
 */
const segs = parseLine('Everyone is *bolting AI on* to a process');
eq('the slide accent grammar still parses', segs.filter((x) => x.highlight).length, 1);
eq('and it keeps the phrase', segs.find((x) => x.highlight)?.text, 'bolting AI on');
ok(
  'a stripped slide headline would lose the accent, which is why it is not stripped',
  parseLine(stripMarkdownEmphasis('Everyone is *bolting AI on* to a process')).every((x) => !x.highlight)
);

// The article stops being markdown: the whole cleaner, end to end.
eq(
  'the article cleaner takes the fence, the dash and the asterisks',
  cleanArticle('```\n**A title** and a line, with a dash\n```'),
  'A title and a line, with a dash'
);

/* ------------------------------------------------------------------ D59: the fold */

/**
 * The preview's only real job is showing where the post folds, so the fold is the thing tested.
 * Every number here traces to docs/pam-console/output-spec.md, which is also where the sourcing
 * lives: two of these are third-party consensus with no official figure, which is why the panel
 * says "roughly" on screen.
 */
const LI = foldRule('linkedin');
const IG = foldRule('instagram');
ok('LinkedIn has a fold rule', Boolean(LI));
ok('Instagram has a fold rule', Boolean(IG));
eq('LinkedIn folds on the mobile figure', LI?.chars, 140);
eq('and after the first paragraph', LI?.paragraphs, 1);
eq('Instagram folds at 125', IG?.chars, 125);
ok('Instagram has no paragraph rule', IG?.paragraphs === undefined);
/**
 * TikTok gets NO rule, and that is the decision rather than an omission: output-spec.md records
 * NO DATA from TikTok, with third-party claims spanning 55 to 150. A made up fold would be worse
 * than none because he would write to it.
 */
ok('TikTok has none, because there is no figure to use', !foldRule('tiktok'));
ok('nor YouTube', !foldRule('youtube'));

// Short copy is not folded at all, and says so by returning an empty tail.
const shortPost = 'Strip the process back first.';
eq('a short post is whole', foldCopy(shortPost, LI).tail, '');
eq('and keeps every character', foldCopy(shortPost, LI).head, shortPost);
eq('no rule means no fold', foldCopy(shortPost, undefined).tail, '');

// Long copy on one line: the character limit bites, and it breaks between words.
const long = 'a'.repeat(60) + ' ' + 'b'.repeat(200);
const foldedLong = foldCopy(long, LI);
eq('a long single line folds on characters', foldedLong.reason, 'chars');
ok('and nothing is lost', foldedLong.head + foldedLong.tail === long);
ok('the head is at or under the limit', foldedLong.head.length <= 140);

/**
 * THE REAL POST HE PUBLISHED, and the reason the rule changed (D77). Metricool's own LinkedIn
 * preview cut this after the first paragraph, 68 characters, nowhere near 140. Their preview is
 * better evidence than the third-party consensus this started from, so the fixture is his actual
 * copy and the expected cut is what Metricool actually showed him.
 */
const hisPost = [
  'Everyone arguing about AI right now is measuring it against a candle.',
  '',
  'Did it save an hour. Did it write the report faster. Did it replace a human task for cheaper. That is the entire debate, and it is the wrong scale.',
  '',
  'On September 4th, 1882, electricity switched on in New York.',
].join('\n');
const his = foldCopy(hisPost, LI);
eq('his post folds at the paragraph, not the character count', his.reason, 'paragraph');
eq('showing exactly the opening line, as Metricool did', his.head, 'Everyone arguing about AI right now is measuring it against a candle.');
eq('which is 69 characters, well short of the 140 the docs implied', his.head.length, 69);
ok('and the rest is behind the fold', his.tail.includes('the wrong scale'));
ok('nothing is lost', his.head + his.tail === hisPost);

/**
 * A post written as ONE BLOCK still gets the character cap, or a wall of text would report as
 * fully visible just because it has no paragraph break.
 */
const oneBlock = 'word '.repeat(80).trim();
const blocked = foldCopy(oneBlock, LI);
eq('one long block folds on characters', blocked.reason, 'chars');
ok('and well under the whole thing', blocked.head.length < oneBlock.length);

// A SINGLE newline is not a paragraph break: that would cut a two-line opening in half.
const twoLines = 'Line one.\nLine two.\n\nAnd the second paragraph.';
const tl = foldCopy(twoLines, LI);
eq('a single newline does not fold it', tl.head, 'Line one.\nLine two.');
eq('the blank line does', tl.reason, 'paragraph');

// Instagram folds on characters only, so the same post cuts at a different place.
const ig = foldCopy(hisPost, IG);
eq('Instagram cuts on length', ig.reason, 'chars');
ok('mid first paragraph', ig.head.length <= 125);

eq('copyLength counts characters', copyLength('12345'), 5);
eq('and counts a newline as one', copyLength('a\nb'), 3);

/* ------------------------------------------------------------------ D61: one timezone */

/**
 * `scheduled_at` is local wall-clock and Metricool takes it paired with a separate IANA zone, so
 * the time and the zone are ONE fact. The zone stamped when the time was chosen wins; config is
 * only for entries planned before the stamp existed.
 */
eq(
  'the stamped zone wins over config',
  timezoneForEntry({ timezone: 'America/New_York' }, 'Australia/Sydney'),
  'America/New_York'
);
eq(
  'an unstamped entry keeps its old behaviour',
  timezoneForEntry({}, 'Australia/Sydney'),
  'Australia/Sydney'
);
eq(
  'a blank stamp counts as absent, not as a zone',
  timezoneForEntry({ timezone: '   ' }, 'Australia/Sydney'),
  'Australia/Sydney'
);
eq(
  'and a stamp is trimmed rather than sent with spaces',
  timezoneForEntry({ timezone: ' Europe/London ' }, 'Australia/Sydney'),
  'Europe/London'
);

/**
 * The other half: every slot the wave places comes WITH its zone. This has always been true and
 * the wave was throwing the zone away, which is the bug D61 fixes, so it is worth holding.
 */
const slotSched = {
  timezone: 'America/New_York',
  channels: { linkedin: ['07:00', '13:00'] },
  modes: {},
  prefers: {},
} as Parameters<typeof nextOpenSlots>[0];
const slots = nextOpenSlots(slotSched, 'linkedin', 2, [], new Date('2026-09-01T00:00:00Z'));
eq('two slots come back', slots.length, 2);
ok(
  'and every one carries the schedule timezone',
  slots.every((sl) => sl.timezone === 'America/New_York')
);
ok('never as a bare string', slots.every((sl) => typeof sl.dateTime === 'string' && sl.dateTime.length >= 16));

/* ------------------------------------------------------------------ D62: two providers */

/**
 * Both new model ids were checked against OpenRouter's public model list before they were written
 * down, which mattered: image-edit.ts carries a note that "the 3.x image previews 404 on this
 * account's OpenRouter access", and the GA ids are different strings from the preview ones. These
 * assertions hold the registry's shape; only a live call can prove account access.
 */
for (const m of IMAGE_MODELS) {
  ok(`${m.id}: has a label and an endpoint`, Boolean(m.label && m.endpoint));
  ok(`${m.id}: provider resolves`, ['higgsfield', 'openrouter'].includes(providerOf(m)));
}
eq('the default is still Soul', DEFAULT_IMAGE_MODEL, 'soul');
ok('and the default resolves to a real model', Boolean(imageModelById(DEFAULT_IMAGE_MODEL)));
eq(
  'an older entry with no provider field reads as higgsfield',
  providerOf({ id: 'x', label: 'x', blurb: 'x', endpoint: 'x', sizing: 'width_and_height' }),
  'higgsfield'
);
eq('Nano Banana 2 is the id he supplied', imageModelById('nano-banana-2')?.endpoint, 'google/gemini-3.1-flash-image');
eq('and it is on OpenRouter', providerOf(imageModelById('nano-banana-2')!), 'openrouter');
ok('and it is flagged as able to render text, which Soul is not', imageModelById('nano-banana-2')?.goodForText === true);
ok('Soul is not', !imageModelById('soul')?.goodForText);

/**
 * NEAREST SOUL SIZE. Higgsfield rejects anything off its allow-list, so a frame has to be mapped
 * rather than passed through. Nearest by ASPECT, because the shape is what a frame is for.
 */
eq('an exact 4:3 frame maps to the 4:3 size', nearestSoulSize({ w: 2048, h: 1536 }), '2048x1536');
eq('a 4:5 slide frame maps to the nearest portrait', nearestSoulSize({ w: 1080, h: 1350 }), '1536x2048');
eq('a square maps to the square', nearestSoulSize({ w: 1000, h: 1000 }), '1536x1536');
eq('16:9 maps to 16:9', nearestSoulSize({ w: 1920, h: 1080 }), '2048x1152');
eq('9:16 maps to the tall one', nearestSoulSize({ w: 1080, h: 1920 }), '1152x2048');
ok(
  'and every answer is a size Soul actually accepts',
  [
    { w: 2048, h: 1536 },
    { w: 1080, h: 1350 },
    { w: 1000, h: 1000 },
    { w: 1920, h: 1080 },
    { w: 1080, h: 1920 },
    { w: 3000, h: 400 },
  ].every((f) => Object.values(SoulSize).includes(nearestSoulSize(f) as never))
);

/** The words that stand in for the missing size parameter. */
ok('a 4:3 frame is described as landscape 4:3', aspectSentence({ w: 2048, h: 1536 }).includes('landscape 4:3'));
ok('a 4:5 frame is described as portrait 4:5', aspectSentence({ w: 1080, h: 1350 }).includes('portrait 4:5'));
ok('and the pixels are named too', aspectSentence({ w: 2048, h: 1536 }).includes('2048 by 1536'));

/** The two controls a screen might offer, both landing on pixels. */
const soulModel = imageModelById('soul')!;
eq('a size string wins', frameFor(soulModel, '2048x1536').w, 2048);
eq('an aspect ratio scales to a 2048 long edge', frameFor(soulModel, undefined, '4:3').w, 2048);
eq('and keeps the ratio', frameFor(soulModel, undefined, '4:3').h, 1536);
eq('neither one falls back to the old default', frameFor(soulModel).w, 1152);
eq('garbage falls back too, rather than producing a zero', frameFor(soulModel, 'wide', 'huge').h, 2048);

/* ------------------------------------------------------------------ D64: one wave per lane */

/**
 * The narrative lock stops the same narrative running twice. This stops two DIFFERENT narratives
 * on one stream both reading the calendar, both finding 07:00 free, and both taking it. Three
 * conditions decide whether the lane is free and each one is a way to get it wrong.
 */
const nowMs = Date.parse('2026-09-01T10:00:00.000Z');
const at = (msAgo: number) => new Date(nowMs - msAgo).toISOString();

ok('nothing held is free', !heldByOther(null, 'n1', nowMs));
ok(
  'held by another narrative, recently, is not free',
  heldByOther({ at: at(5_000), narrative: 'n2' }, 'n1', nowMs)
);
ok(
  'held by THIS narrative is free, or a retry refuses its own lock',
  !heldByOther({ at: at(5_000), narrative: 'n1' }, 'n1', nowMs)
);
ok(
  'an expired lock is free, or a crashed run wedges the stream forever',
  !heldByOther({ at: at(WAVE_LOCK_MS + 1_000), narrative: 'n2' }, 'n1', nowMs)
);
ok(
  'exactly at the window it has expired',
  !heldByOther({ at: at(WAVE_LOCK_MS), narrative: 'n2' }, 'n1', nowMs)
);
ok(
  'a lock with an unparseable time is free rather than permanent',
  !heldByOther({ at: 'whenever', narrative: 'n2' }, 'n1', nowMs)
);
ok(
  'a future-dated lock still holds, rather than reading as expired',
  heldByOther({ at: at(-30_000), narrative: 'n2' }, 'n1', nowMs)
);

// A malformed stored blob must read as "no lock", never as a lock nobody can clear.
ok('junk is not a lock', parseHeld({ nonsense: true }) === null);
ok('null is not a lock', parseHeld(null) === null);
ok('a blank time is not a lock', parseHeld({ at: '   ', narrative: 'n' }) === null);
eq(
  'a real one keeps its narrative',
  parseHeld({ at: '2026-09-01T10:00:00.000Z', narrative: 'n7' })?.narrative,
  'n7'
);
eq(
  'and a missing narrative reads as empty rather than undefined',
  parseHeld({ at: '2026-09-01T10:00:00.000Z' })?.narrative,
  ''
);

/* ------------------------------------------------------------------ D65: upload */

/**
 * The same rules run in the browser (to say no before a 40MB file is read) and on the server
 * (which cannot trust the browser for any of it), so they are one pure function and it is tested
 * once. The three refusals are deliberately different messages, because "too big" is something he
 * can act on, "video" is a platform limit with a named workaround, and an unknown type is neither.
 */
const okPng = checkUpload('image/png', 2 * 1024 * 1024);
ok('a 2MB png is fine', okPng.ok);
eq('and its extension is png', okPng.ok ? okPng.ext : '', 'png');
eq('jpeg maps to jpg', (() => { const r = checkUpload('image/jpeg', 1000); return r.ok ? r.ext : ''; })(), 'jpg');
ok('webp is allowed', checkUpload('image/webp', 1000).ok);
ok('a charset on the type does not break it', checkUpload('image/png; charset=binary', 1000).ok);
ok('and neither does casing', checkUpload('IMAGE/PNG', 1000).ok);

// VIDEO IS REFUSED HERE, with the reason, rather than uploaded and then found to be unservable.
const vid = checkUpload('video/mp4', 1000);
ok('video is refused', !vid.ok);
ok('and the refusal names Box, which is the actual workaround', !vid.ok && /Box/.test(vid.error));
ok('a mov is refused too', !checkUpload('video/quicktime', 1000).ok);

// Size, at the boundary in both directions.
ok('exactly at the cap is allowed', checkUpload('image/png', MAX_UPLOAD_BYTES).ok);
ok('one byte over is not', !checkUpload('image/png', MAX_UPLOAD_BYTES + 1).ok);
ok('an empty file is refused', !checkUpload('image/png', 0).ok);
ok('and so is a nonsense size', !checkUpload('image/png', Number.NaN).ok);
ok('a pdf is refused for now', !checkUpload('application/pdf', 1000).ok);
ok('and something unknown is refused', !checkUpload('application/x-thing', 1000).ok);

/**
 * The label is the only thing a filename is used for. It never reaches the stored key, which is a
 * uuid, so a name cannot walk the path or collide.
 */
eq('separators become spaces', labelFromFilename('brand-shoot_final-v3.jpg'), 'brand shoot final v3');
eq('the extension goes', labelFromFilename('hero.png'), 'hero');
eq('a name that is only an extension still gets a label', labelFromFilename('.png'), 'Uploaded image');
eq('an empty name gets one too', labelFromFilename(''), 'Uploaded image');
ok('a long name is capped', labelFromFilename('x'.repeat(300) + '.png').length <= 90);
eq('a path-looking name is text, not a path', labelFromFilename('../../etc/passwd.png'), '../../etc/passwd');

// Every offered type is one the check accepts, or the file dialog would filter to a refusal.
for (const t of Object.keys(UPLOAD_TYPES)) {
  ok(`${t}: offered and accepted`, checkUpload(t, 1000).ok);
}

/* ------------------------------------------------------------------ D66: the analytics mock */

/**
 * A MOCK'S ONLY JOB IS TO BE TRUSTED ABOUT SHAPE, so the thing tested is that it adds up. The first
 * version generated the per-network numbers independently of the headline, so a tile said 95.3K
 * beside four bars summing to 63K, and nobody would trust a panel that cannot add up.
 */
for (const scope of ['engine', 'marrs', 'polynize', 'kristin']) {
  const a = mockAnalytics(scope);
  eq(
    `${scope}: the platform split sums to the headline`,
    a.byNetwork.reduce((t, n) => t + n.impressions, 0),
    a.impressions
  );
  eq(`${scope}: the trend sums to the headline too`, a.trend.reduce((t, n) => t + n, 0), a.impressions);
  eq(`${scope}: twelve trend points`, a.trend.length, 12);
  ok(`${scope}: no negative share`, a.byNetwork.every((n) => n.impressions >= 0));
  ok(`${scope}: the bars are sorted biggest first`, a.byNetwork.every((n, i, arr) => i === 0 || arr[i - 1].impressions >= n.impressions));
  ok(
    `${scope}: no single best post exceeds the period`,
    a.topPosts.every((p) => p.impressions <= a.impressions)
  );
  ok(`${scope}: and they are sorted too`, a.topPosts.every((p, i, arr) => i === 0 || arr[i - 1].impressions >= p.impressions));
}

/**
 * DETERMINISTIC, and this is not a nicety: the panel renders on the SERVER, so a random number
 * would differ from the one the browser computes, which is a hydration mismatch rather than a
 * cosmetic difference.
 */
eq(
  'the same scope gives the same numbers every time',
  JSON.stringify(mockAnalytics('marrs')),
  JSON.stringify(mockAnalytics('marrs'))
);
ok(
  'and two scopes do not give identical numbers',
  JSON.stringify(mockAnalytics('marrs')) !== JSON.stringify(mockAnalytics('kristin'))
);
ok('the scale multiplies the numbers up', mockAnalytics('marrs', 4).impressions > mockAnalytics('marrs').impressions);

// The stat tile's auto-compact contract: separated under 10,000, compacted above.
eq('a small number keeps its separator', compactNumber(1284), '1,284');
eq('ten thousand compacts', compactNumber(12_900), '12.9K');
eq('a round compact loses its .0', compactNumber(12_000), '12K');
eq('millions compact too', compactNumber(4_200_000), '4.2M');
eq('9,999 is still readable in full', compactNumber(9999), '9,999');
eq('zero is zero', compactNumber(0), '0');

// A flat period has to READ as flat, not as a blank.
eq('a positive delta carries its sign', signedPct(12.3), '+12.3%');
eq('a negative one keeps its own', signedPct(-4.6), '-4.6%');
eq('and flat is said in words', signedPct(0), 'no change');
eq('a rounding-to-zero delta is flat too', signedPct(0.04), 'no change');

/** The sparkline geometry: inside its box, oldest to newest, biggest value at the smallest y. */
const sp = sparklinePoints([10, 50, 30], 100, 40, 3);
eq('one point per value', sp.pts.length, 3);
ok('all inside the box', sp.pts.every((p) => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 40));
ok('x increases left to right', sp.pts.every((p, i, arr) => i === 0 || arr[i - 1].x < p.x));
ok('the largest value sits highest, which is the smallest y', sp.pts[1].y < sp.pts[0].y && sp.pts[1].y < sp.pts[2].y);
eq('a flat series does not divide by zero', sparklinePoints([5, 5, 5], 100, 40).pts.length, 3);
eq('an empty series draws nothing', sparklinePoints([], 100, 40).pts.length, 0);

/* ------------------------------------------------------------------ D68: where a lane lives */

/**
 * Marrs: "Kristen's in California, but that's okay. We can fix that."
 *
 * Three levels of precedence and every one of them exists for a reason, so all three are held:
 * a value the operator saved beats the lane's known home, which beats the Sydney default.
 */
eq('Kristin is on California time by default', laneTimezone('kristin'), 'America/Los_Angeles');
eq('and everyone else is on Sydney', laneTimezone('marrs'), 'Australia/Sydney');
eq('an unknown lane gets Sydney too', laneTimezone('someone-new'), 'Australia/Sydney');
eq('no lane at all still resolves', laneTimezone(undefined), 'Australia/Sydney');
eq(
  'what the operator saved beats the lane default',
  laneTimezone('kristin', 'Europe/London'),
  'Europe/London'
);
eq(
  'and it beats Sydney for everyone else',
  laneTimezone('marrs', 'America/New_York'),
  'America/New_York'
);
eq('a blank saved value is ignored, not sent as a zone', laneTimezone('kristin', '   '), 'America/Los_Angeles');

// The default schedule carries it, which is what the wave reads when no file exists.
eq('the default schedule uses the lane home', defaultChannelSchedule('kristin').timezone, 'America/Los_Angeles');
eq('and honours an override', defaultChannelSchedule('kristin', 'Asia/Tokyo').timezone, 'Asia/Tokyo');
eq('marrs stays put', defaultChannelSchedule('marrs').timezone, 'Australia/Sydney');

/**
 * A STORED value still wins over both, or a deliberate setting would be overwritten by a default
 * every time the file was read.
 */
eq(
  'a stored zone beats everything',
  normalizeChannelSchedule({ timezone: 'Pacific/Auckland' }, 'kristin', 'Europe/London').timezone,
  'Pacific/Auckland'
);
eq(
  'an absent stored zone falls to the editable one',
  normalizeChannelSchedule({}, 'kristin', 'Europe/London').timezone,
  'Europe/London'
);
eq(
  'and with neither, to the lane home',
  normalizeChannelSchedule({}, 'kristin').timezone,
  'America/Los_Angeles'
);

/**
 * THE POINT OF ALL OF IT: a slot picked on Kristin's lane is paired with HER zone, because
 * scheduled_at is wall-clock and a wall-clock time without its zone is not a time.
 */
const kSlots = nextOpenSlots(
  defaultChannelSchedule('kristin'),
  'instagram',
  1,
  [],
  new Date('2026-09-01T00:00:00Z')
);
eq('one slot back', kSlots.length, 1);
eq('carrying California, not Sydney', kSlots[0].timezone, 'America/Los_Angeles');

/* ------------------------------------------------------------------ D69: the analytics probe */

/**
 * The probe's whole value is the verdict it prints, so the verdict logic is what is tested. A false
 * "no overlap" would send the build down a fragile fallback join for nothing, and a false "they
 * match" is worse: it would ship a panel attaching numbers to the wrong pieces.
 */
eq(
  'matching ids close the loop',
  joinReport(['111', '222'], ['222', '333']).verdict,
  'they match, the loop closes'
);
eq(
  'no overlap says so',
  joinReport(['111'], ['999']).verdict,
  'no overlap, a fallback join is needed'
);
eq('nothing of ours cannot be judged', joinReport([], ['999']).verdict, 'no ids of ours to compare');
eq('nothing of theirs cannot either', joinReport(['111'], []).verdict, 'analytics returned no ids');

/**
 * A NUMBER AND A STRING ARE THE SAME ID. One side of a documented-but-untested pairing may well be
 * numeric and the other a string, and reporting "no overlap" over a type difference is exactly the
 * false negative that would cost a day.
 */
eq(
  'a numeric id matches its string',
  joinReport(['12345'], [12345 as unknown as string]).verdict,
  'they match, the loop closes'
);
eq('whitespace does not break a match', joinReport([' 42 '], ['42']).matched.length, 1);
eq('and blanks are dropped rather than matched', joinReport(['', '  '], ['']).verdict, 'no ids of ours to compare');
eq('duplicates are counted once', joinReport(['7', '7'], ['7']).ours.length, 1);

/**
 * HARVESTING IDS IS SHAPE-AGNOSTIC ON PURPOSE. We do not yet know whether the feed is
 * { data: [] }, { posts: [] } or a bare array, so guessing one and finding nothing would be
 * indistinguishable from the endpoint being empty.
 */
eq('a bare array', harvestIds([{ id: 'a' }, { id: 'b' }]).length, 2);
eq('wrapped in data', harvestIds({ data: [{ id: 'a' }] })[0], 'a');
eq('wrapped twice', harvestIds({ result: { posts: [{ postId: 'x' }] } })[0], 'x');
eq('snake case too', harvestIds({ posts: [{ post_id: 'y' }] })[0], 'y');
eq('numbers become strings', harvestIds({ id: 99 })[0], '99');
eq('nothing to find is empty, not a crash', harvestIds({ a: { b: { c: 1 } } }).length, 0);
eq('null is safe', harvestIds(null).length, 0);
eq('a string is safe', harvestIds('nope').length, 0);
// A cycle-shaped or absurdly deep blob must not hang the page.
const deep: Record<string, unknown> = { id: 'top' };
let cur = deep;
for (let i = 0; i < 40; i += 1) {
  const next: Record<string, unknown> = { id: `deep${i}` };
  cur.child = next;
  cur = next;
}
ok('depth is bounded rather than unbounded', harvestIds(deep).length < 12);

/* ------------------------------------------------------------------ D70: say what broke */

/**
 * Marrs: "April is not working getting error: April is unavailable right now. Try again in a
 * moment." One message, thrown by eleven routes, meaning eleven different things, and "try again"
 * is wrong advice for most of them.
 *
 * These hold the mapping, because a message that names the wrong cause is worse than the generic
 * one: it sends someone to check a key that was never the problem.
 */
const t = (m: string) => llmErrorText(new Error(m));

ok('a missing key says so', /no API key configured/.test(t('OPENROUTER_API_KEY is not set')));
ok('and names the env vars', /OPENROUTER_API_KEY/.test(t('OPENROUTER_API_KEY is not set')));

// The one that looks like an outage and is not: the reasoning floor, which has bitten twice.
ok('empty content blames the token ceiling', /max_tokens/.test(t('OpenRouter returned no content')));
ok('and does not tell him to retry', !/worth a retry/.test(t('OpenRouter returned no content')));

ok('a timeout reads as a timeout', /took too long/.test(t('OpenRouter stream timed out after 240000ms (model=x)')));

// The statuses where retrying is pointless get told apart from the one where it is not.
ok('401 points at the key', /refused the key \(401\)/.test(t('OpenRouter 401: {"error":"no auth"}')));
ok('and says a retry will not fix it', /no retry will fix it/.test(t('OpenRouter 401: nope')));
ok('403 lands on the same answer', /refused the key \(403\)/.test(t('OpenRouter 403: forbidden')));
ok('402 is out of credit', /out of credit/.test(t('OpenRouter 402: insufficient balance')));
ok('404 is the model, not the key', /model available on this key/.test(t('OpenRouter 404: no such model')));
ok('429 IS worth waiting for', /waiting a minute/.test(t('OpenRouter 429: slow down')));
ok('a 500 blames their side', /Their side, not ours/.test(t('OpenRouter 503: upstream')));
ok('400 is a payload problem', /payload problem/.test(t('OpenRouter 400: bad request field')));

// The caller's own name for itself, since two different words already existed for one layer.
ok('the writing assistant keeps its name', /The writing assistant took too long/.test(llmErrorText(new Error('timed out'), 'The writing assistant')));

/**
 * NEVER ECHO A SECRET. The provider errors carry a response body, and while OpenRouter's do not
 * include the key, a redaction pass costs nothing and the alternative is trusting that forever.
 */
const leaked = llmErrorText(new Error('OpenRouter said: Authorization: Bearer sk-or-v1-abcdef1234567890abcdef'));
ok('a bearer token is redacted', !/sk-or-v1-abcdef/.test(leaked));
ok('and so is the sk- form', !/sk-live-/.test(llmErrorText(new Error('key sk-live-9876543210abcdef failed'))));
ok('a long hex blob goes too', !/deadbeef1234567890abcdef1234567890/.test(llmErrorText(new Error('token deadbeef1234567890abcdef1234567890'))));
ok('but the sentence still says something', llmErrorText(new Error('weird failure')).length > 10);

// An unrecognised error hands back what was said rather than inventing a category.
ok('unknown errors are passed through', /weird failure/.test(t('weird failure')));
ok('and are capped rather than dumped', llmErrorText(new Error('x'.repeat(4000))).length < 400);
ok('a non-Error is survivable', llmErrorText(null).length > 0);

/* ------------------------------------------------------------------ D73: where it broke */

/**
 * Marrs: "April failed: Maximum call stack size exceeded".
 *
 * A RangeError from our own code, not a provider answer, and the message alone cost an hour: the
 * markdown stripper, the fence unwrap, the streaming loop, the model list and the account were all
 * checked and cleared before it was clear the message would never say WHERE.
 *
 * So an unclassifiable error carries the top of its stack now. These hold the two halves of that:
 * the unclassified case gains a location, and a classified one does not gain noise.
 */
function blowTheStack(): string {
  const recurse = (n: number): number => (n <= 0 ? 0 : recurse(n - 1) + 1);
  try {
    recurse(1e6);
    return 'did not throw';
  } catch (e) {
    return llmErrorText(e, 'April');
  }
}
const stacked = blowTheStack();
ok('the RangeError message survives', /Maximum call stack size exceeded/.test(stacked));
ok('and it now says where', /\[[^\]]*:\d+:\d+/.test(stacked));
ok('naming a file', /gate4\.test/.test(stacked));

// A classified provider error needs no stack: its own sentence already names the fix.
const classified = llmErrorText(new Error('OpenRouter 402: insufficient balance'));
ok('402 gains no stack', !/:\d+:\d+/.test(classified));
ok('nor does 401', !/:\d+:\d+/.test(llmErrorText(new Error('OpenRouter 401: nope'))));
ok('nor an empty response', !/:\d+:\d+/.test(llmErrorText(new Error('OpenRouter returned no content'))));

// A thrown non-Error has no stack to take, and must not crash the reporter.
ok('a string throw is survivable', llmErrorText('just a string').length > 0);
ok('and gains no bracket', !/\[/.test(llmErrorText('just a string')));

/* ------------------------------------------------------------------ D74: the lane register */

/**
 * THE TEST THAT SHOULD HAVE EXISTED A WEEK AGO.
 *
 * `laneVoice` read `return laneVoice(lane) ?? KIND_VOICE[...]`: the function's own name where the
 * MAP belonged. Unconditional infinite recursion, so every article draft and every April revision
 * threw "Maximum call stack size exceeded" and Gate 2 was dead for a week.
 *
 * Nothing caught it. TypeScript cannot, because `laneVoice(lane)` is a `string` and `string ?? x`
 * is legal rather than an error. No lint runs here. And D45's tests covered the KIT's per-stream
 * invariant rather than this one, so the safety net that commit described did not reach the line.
 *
 * So: every lane, every time, a real string. Merely CALLING it is most of the test, because the
 * failure mode was a throw rather than a wrong answer.
 */
for (const lane of STREAM_IDS) {
  let out = '';
  let threw = '';
  try {
    out = laneVoice(lane);
  } catch (e) {
    threw = e instanceof Error ? e.message : String(e);
  }
  eq(`${lane}: the lane register does not throw`, threw, '');
  ok(`${lane}: and returns real instruction text`, out.length > 40);
  ok(`${lane}: naming a register`, /lane/i.test(out));
}

// The hand-written overrides are USED, which is the half a fallback-only version would still pass.
ok('marrs gets his own register', /MARRS lane/.test(laneVoice('marrs')));
ok('polynize gets its own', /POLYNIZE lane/.test(laneVoice('polynize')));

/**
 * And a lane with no hand-written register falls back to its KIND rather than to nothing, which is
 * the behaviour D45 was actually trying to add when it introduced the bug.
 */
ok('kristin falls back to the person register', /PERSONAL lane/.test(laneVoice('kristin')));
ok('and a person register is not the brand one', !/BRAND lane/.test(laneVoice('kristin')));

/* ------------------------------------------------------------------ D78: connected platforms */

/**
 * Marrs: "In Gate 3 how do we only show platforms that the user is subscribed to in Metricool? We
 * can do this manually if needed."
 *
 * It did not need to be manual: /admin/simpleProfiles already carries a per-platform field on every
 * brand and non-null means connected. The fixture below is his OWN Polynize brand, copied from the
 * probe output, so this is tested against a real response rather than an imagined one.
 */
const polynizeBrand = {
  id: 5249078,
  label: 'Polynize AI',
  twitter: null,
  facebook: '787610667764287',
  instagram: 'polynize.ai',
  linkedinCompany: 'urn:li:organization:18565952',
  youtube: null,
  tiktok: 'polynize.ai',
  threads: null,
  bluesky: null,
  pinterest: null,
  inUserId: null,
};
const pn = networksFromProfile(polynizeBrand);
ok('his Instagram is connected', pn.has('instagram'));
ok('his TikTok is connected', pn.has('tiktok'));
ok('LinkedIn counts via the COMPANY field, which is the only one his brand has', pn.has('linkedin'));
ok('YouTube is not connected, and is not claimed to be', !pn.has('youtube'));
eq('so three of our four networks', pn.size, 3);

/**
 * LINKEDIN NEEDS THREE FIELDS. There is no plain `linkedin`: a company page arrives as
 * linkedinCompany and a PERSONAL profile as inUserId or linkedInUserProfileURL. Checking only the
 * company field would have hidden LinkedIn on every personal lane, which is four of the five people
 * here and the platform he cares most about.
 */
ok('a personal profile counts via inUserId', networksFromProfile({ inUserId: '12345' }).has('linkedin'));
ok('and via the profile url', networksFromProfile({ linkedInUserProfileURL: 'https://x' }).has('linkedin'));
ok('an empty string is not a connection', !networksFromProfile({ instagram: '   ' }).has('instagram'));
ok('nor is null', !networksFromProfile({ instagram: null }).has('instagram'));
eq('junk yields nothing rather than throwing', networksFromProfile('nope').size, 0);
eq('and so does null', networksFromProfile(null).size, 0);

/**
 * THE RULE FAILS OPEN, and this is the assertion that matters most: hiding work because a config
 * call timed out is worse than offering a platform he cannot post to, because he would have no way
 * to tell that from "we decided not to post there".
 */
ok('unknown shows every network', networkAvailable(null, 'youtube'));
ok('known shows what is connected', networkAvailable(['linkedin', 'instagram'], 'instagram'));
ok('and hides what is not', !networkAvailable(['linkedin', 'instagram'], 'youtube'));
/** An empty list is an ANSWER, not an absence: this brand genuinely has nothing wired up. */
ok('an empty answer hides everything', !networkAvailable([], 'linkedin'));

/* ------------------------------------------------------------------ D79: the queue */

/**
 * THE QUEUE IS ONE TABLE NOW. It used to be two: this route read per-STREAM slots while the wave
 * read per-NETWORK ones, so queueing a LinkedIn post consumed a slot from a list the wave never
 * looked at. These assert the shape the queue now runs on, which is the same one the wave uses.
 */
const queueLane = normalizeChannelSchedule(
  { timezone: 'Australia/Sydney', channels: { linkedin: ['08:30', '12:30'], instagram: ['09:00'] } },
  'polynize'
);
eq('two LinkedIn times means two LinkedIn posts a day', queueLane.channels.linkedin.length, 2);
eq('and Instagram keeps its own one', queueLane.channels.instagram.length, 1);

/** PER PLATFORM: a busy LinkedIn cannot push an Instagram post into next week. */
const liTaken = ['2026-09-01T08:30:00', '2026-09-01T12:30:00'];
/** `from` is a real instant; 07:00 on 1 Sep in Sydney is 21:00 UTC the day before. */
const queueFrom = new Date('2026-08-31T21:00:00Z');
const igNext = nextOpenSlots(queueLane, 'instagram', 1, liTaken, queueFrom);
eq('Instagram is untouched by LinkedIn being full', igNext[0]?.dateTime, '2026-09-01T09:00:00');
const liNext = nextOpenSlots(queueLane, 'linkedin', 1, liTaken, queueFrom);
eq('while LinkedIn rolls to the next day', liNext[0]?.dateTime, '2026-09-02T08:30:00');

/**
 * AN EMPTIED LIST FALLS BACK TO DEFAULTS rather than to no posting at all, which is right for a
 * broken config file and is why the save route echoes back what was stored: otherwise you clear a
 * field, save, and find the defaults back in it with nothing having said so.
 */
eq(
  'clearing a network restores its defaults',
  normalizeChannelSchedule({ timezone: 'Australia/Sydney', channels: { linkedin: [] } }, 'polynize')
    .channels.linkedin.length,
  2
);
eq(
  'and a malformed time is dropped, not stored',
  normalizeChannelSchedule({ timezone: 'Australia/Sydney', channels: { linkedin: ['08:30', '99:99'] } }, 'polynize')
    .channels.linkedin.join(','),
  '08:30'
);

/** MODE SURVIVES the read-merge-write the save route does, because the wave owns `prefers`. */
ok(
  'his personal LinkedIn stays hand-posted by default',
  normalizeChannelSchedule({ timezone: 'Australia/Sydney' }, 'marrs').modes.linkedin === 'manual'
);

/* the depth note: a sentence, not a limit */
eq('same day is zero', daysBetween('2026-09-01', '2026-09-01'), 0);
eq('across a month boundary', daysBetween('2026-08-30', '2026-09-02'), 3);
eq('junk counts as nothing rather than throwing', daysBetween('', '2026-09-02'), 0);
eq('a date is read in the channel timezone', todayIn('Australia/Sydney', new Date('2026-08-28T23:00:00Z')), '2026-08-29');
eq('and an unknown zone degrades to UTC rather than failing', todayIn('Not/AZone', new Date('2026-08-28T23:00:00Z')), '2026-08-28');

const soon = queueDepthNote('2026-08-30T08:30:00', 'Australia/Sydney', 'LinkedIn', new Date('2026-08-28T02:00:00Z'));
eq('nothing is said about a post two days out', soon, '');
const deepNote = queueDepthNote('2026-09-15T08:30:00', 'Australia/Sydney', 'LinkedIn', new Date('2026-08-28T02:00:00Z'));
ok('a queue eighteen days deep says so', /18 days deep/.test(deepNote));
ok('and names the platform, because the queue is per platform', /LinkedIn/.test(deepNote));
ok('with no em dash in it', !deepNote.includes('\u2014'));
const edge = queueDepthNote('2026-09-04T08:30:00', 'Australia/Sydney', 'LinkedIn', new Date('2026-08-28T02:00:00Z'));
ok(`the threshold is ${DEEP_DAYS} days and it is inclusive`, /7 days deep/.test(edge));

/* ------------------------------------------------------------------ D80: the finished-media door */

/**
 * Marrs: "I recorded that video. It's edited. I've got three versions of it, and I'm not sure how to
 * post it using the console, which is an issue."
 *
 * The door is a piece with no Story behind it. These assert the one field that made the difference,
 * because it reads like a technicality and decides which screen he lands on.
 */
const doorPiece = finishedMediaPieceFor({
  piece_id: 'p1',
  owner: 'marrs@polynize.io',
  stream: 'marrs',
  label: 'Force multiplier cut A',
  media_id: 'm1',
});
ok('it is a valid piece with no concept and no narrative', isValidPiece(doorPiece));
ok('and it carries neither ref', !doorPiece.concept_ref && !doorPiece.narrative_ref);
eq('the caption module, not the script module', doorPiece.kind, 'text');
eq('the file is attached', doorPiece.media?.join(','), 'm1');
eq('and no platform is chosen on his behalf', doorPiece.platforms?.length, 0);
eq('the title is the file label, which is what he named it', doorPiece.title, 'Force multiplier cut A');
eq('the script is an empty string, not absent', typeof doorPiece.script, 'string');

/**
 * THE FORMAT IS REGISTERED, which is what stops `kindOf` guessing. An unregistered format defaults
 * to video, and that default is exactly the bug: it opened a finished film on the teleprompter.
 */
ok('the format exists in the registry', Boolean(formatById(FINISHED_MEDIA_FORMAT)));
eq('so kindOf resolves it to text rather than defaulting to video', kindOf(FINISHED_MEDIA_FORMAT), 'text');
eq('an unregistered format still defaults to video, which is why registering mattered', kindOf('not_a_format'), 'video');

/**
 * THE YOUTUBE TITLE IS THE FIRST LINE OF THE POST (D82).
 *
 * Marrs: "Is there a way we can take the first line of the post and make that the YouTube title, or
 * how are we making that up?" It used to take the piece title first, which is an internal filing
 * name in every case that exists: a media library label, or "<headline>: Numbered rules".
 */
eq(
  'the first line wins, and it is the line he actually wrote',
  youtubeTitleFrom('Is this AI Business Advice BS?\n\nThe internet is full of creators', 'cut A.mp4'),
  'Is this AI Business Advice BS?'
);
eq('the label is the fallback only when there is no copy', youtubeTitleFrom('', 'Force multiplier cut A'), 'Force multiplier cut A');
eq('nothing to call it yields nothing, so no empty title is sent', youtubeTitleFrom('', ''), '');
eq('and a missing label is not a crash', youtubeTitleFrom(''), '');
/** Metricool: "must be SHORTER THAN 100 characters", so 99 (D81). An inclusive read is a rejection. */
eq('the cap is 99, not 100', YOUTUBE_TITLE_MAX, 99);
ok(
  `a long first line is capped at ${YOUTUBE_TITLE_MAX}`,
  youtubeTitleFrom('word '.repeat(60), '').length <= YOUTUBE_TITLE_MAX
);
/** Cut at a word boundary, never mid-word: a title sliced through a word reads as a fault. */
ok(
  'and cut between words rather than through one',
  !youtubeTitleFrom('word '.repeat(60), '').endsWith('wor')
);
/** A single unbroken run has no boundary to back up to, so the hard cap still applies. */
eq(
  'an unbroken run still gets cut, because the cap is the platform speaking',
  youtubeTitleFrom('x'.repeat(140), '').length,
  YOUTUBE_TITLE_MAX
);
/** Their validator: "The characters < or > are not allowed." They arrive by accident, so they go. */
eq('angle brackets are stripped rather than failing the post', youtubeTitleFrom('a <b> c', ''), 'a b c');

/* ------------------------------------------------------------------ D81: per-network settings */

/**
 * Metricool's own composer, on a real post of his: "Instagram does not allow single-video posts.
 * Change the Instagram post type to REEL or add more videos or images." The read below is how the
 * remaining unknown (youtubeData.type for a Short) gets answered from his account rather than guessed.
 */
const oneScheduled = {
  data: [
    {
      id: 367684553,
      providers: [{ network: 'instagram' }, { network: 'youtube' }],
      instagramData: { type: 'REEL' },
      youtubeData: { title: 'Cut A', madeForKids: false },
    },
  ],
};
const settingsFound = networkSettings(oneScheduled);
eq('one post carried settings', settingsFound.length, 1);
eq('its networks are read off the provider objects', settingsFound[0].networks.join(','), 'instagram,youtube');
eq('and the id survives as a string, whichever type it arrived as', settingsFound[0].id, '367684553');
eq('junk yields nothing rather than throwing', networkSettings('nope').length, 0);
eq('and a post with no per-network block is not reported', networkSettings({ data: [{ id: 1 }] }).length, 0);

/**
 * A CHANNEL WITH NO QUEUE RETURNS NOTHING RATHER THAN THROWING. The calendar offers "Add to queue"
 * on any channel Metricool can reach, which includes X, and the slot finder used to spread an
 * undefined default and 500.
 */
const xSchedule = normalizeChannelSchedule({ timezone: 'Australia/Sydney' }, 'polynize');
eq(
  'an unknown network yields no slots instead of a TypeError',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nextOpenSlots(xSchedule, 'x' as any, 1, []).length,
  0
);

/* ------------------------------------------------------------------ D83: is the time reachable */

/**
 * Metricool, on a post Marrs dated today and left the time blank:
 *   "Invalid value 'DateTimeInfo(dateTime=2026-09-02T09:00:00, timezone=Australia/Sydney)'.
 *    Given datetime cannot be in the past."
 *
 * He never chose 09:00. A constant did, and nothing checked it was still ahead.
 */
const SYD = 'Australia/Sydney';
/** 2 September 2026, 14:00 in Sydney, which is 04:00 UTC. His actual situation. */
const afternoon = new Date('2026-09-02T04:00:00Z');
const liSlots = ['08:30', '12:30', '17:00'];

const dateOnlyLate = resolvePostTime({
  scheduledAt: '2026-09-02',
  timezone: SYD,
  slots: liSlots,
  channel: 'LinkedIn',
  now: afternoon,
});
ok('a date with no time resolves rather than refusing', dateOnlyLate.ok);
eq(
  'to the first posting time on that date that has not passed, not to 09:00',
  dateOnlyLate.ok ? dateOnlyLate.dateTime : '',
  '2026-09-02T17:00:00'
);
ok('and it is marked derived, so the entry can be stamped with it', dateOnlyLate.ok && dateOnlyLate.derived);

/** Morning: the earliest slot is still ahead, so it wins. */
const dateOnlyEarly = resolvePostTime({
  scheduledAt: '2026-09-02',
  timezone: SYD,
  slots: liSlots,
  channel: 'LinkedIn',
  now: new Date('2026-09-01T21:00:00Z'), // 07:00 Sydney
});
eq('the earliest slot when the day has not started', dateOnlyEarly.ok ? dateOnlyEarly.dateTime : '', '2026-09-02T08:30:00');

/** Every slot gone: refused, and it says how to get out of it rather than moving his date. */
const allGone = resolvePostTime({
  scheduledAt: '2026-09-02',
  timezone: SYD,
  slots: liSlots,
  channel: 'LinkedIn',
  now: new Date('2026-09-02T09:00:00Z'), // 19:00 Sydney
});
ok('a day whose slots have all passed is refused', !allGone.ok);
ok('and the refusal names the times', !allGone.ok && /08:30, 12:30, 17:00/.test(allGone.error));
ok('and offers the queue as the way out', !allGone.ok && /Add to queue/.test(allGone.error));

/** A time he chose himself is used exactly, and only checked for reachability. */
const chosen = resolvePostTime({
  scheduledAt: '2026-09-03T06:15',
  timezone: SYD,
  slots: liSlots,
  channel: 'LinkedIn',
  now: afternoon,
});
eq('a chosen time is used as chosen, slots or no slots', chosen.ok ? chosen.dateTime : '', '2026-09-03T06:15:00');
ok('and is not marked derived', chosen.ok && !chosen.derived);

const chosenPast = resolvePostTime({
  scheduledAt: '2026-09-02T09:00',
  timezone: SYD,
  slots: liSlots,
  channel: 'LinkedIn',
  now: afternoon,
});
ok('a chosen time in the past is refused here rather than by Metricool', !chosenPast.ok);
ok('and the sentence is one he can act on', !chosenPast.ok && /already passed/.test(chosenPast.error));

/** THE TIMEZONE DECIDES WHAT "PAST" MEANS. The same instant is a different day in California. */
const kristin = resolvePostTime({
  scheduledAt: '2026-09-02',
  timezone: 'America/Los_Angeles',
  slots: liSlots,
  channel: 'LinkedIn',
  now: afternoon, // 2 Sep 14:00 Sydney is 1 Sep 21:00 in LA
});
eq(
  'her whole day is still ahead, so the earliest slot stands',
  kristin.ok ? kristin.dateTime : '',
  '2026-09-02T08:30:00'
);

/** A channel with no queue keeps the old constant, then gets checked like anything else. */
const noSlots = resolvePostTime({
  scheduledAt: '2026-09-03',
  timezone: SYD,
  slots: [],
  channel: 'X',
  now: afternoon,
});
eq('no slots falls back to 09:00 on a future date', noSlots.ok ? noSlots.dateTime : '', '2026-09-03T09:00:00');
ok(
  'and refuses it on a date where 09:00 has gone',
  !resolvePostTime({ scheduledAt: '2026-09-02', timezone: SYD, slots: [], channel: 'X', now: afternoon }).ok
);
ok('no date at all is refused', !resolvePostTime({ scheduledAt: '', timezone: SYD, slots: [], channel: 'X', now: afternoon }).ok);

/* ------------------------------------------------------------------ D84: short or landscape */

/**
 * THE TOKEN IS LOWERCASE `short`, READ OFF HIS OWN ACCOUNT. Their spec gives youtubeData.type no
 * values and the word SHORT appears nowhere in 1.2MB of schema, so the probe read it back from two
 * real scheduled posts:
 *   "youtubeData": { "title": "Which Type are You?", "type": "short", "privacy": "public" }
 *
 * Case is NOT consistent across their API, which is exactly why each one is copied rather than
 * assumed: YouTube's is lowercase `short`, Instagram's is uppercase `REEL`, LinkedIn's is `POST`.
 */
eq('a Short sends the lowercase token from his data', youtubeTypeToken('short'), 'short');
eq('and the default is Short, because everything this pipeline makes is vertical', youtubeTypeToken(undefined), 'short');
/**
 * A LANDSCAPE VIDEO SENDS NOTHING. Its token is not in his data, and the default already accepts
 * horizontal: the rejection was specific to orientation. Sending nothing is the only option with no
 * guess in it.
 */
eq('landscape sends no type rather than a guessed one', youtubeTypeToken('landscape'), undefined);
eq('the label says which, so the choice is never invisible', youtubeTypeLabel('short'), 'Short (vertical)');
eq('and for the other', youtubeTypeLabel('landscape'), 'Landscape video');
ok('the guard accepts the two values', isYoutubeVideoType('short') && isYoutubeVideoType('landscape'));
ok('and rejects anything else, including the API token for a plain video', !isYoutubeVideoType('video'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
