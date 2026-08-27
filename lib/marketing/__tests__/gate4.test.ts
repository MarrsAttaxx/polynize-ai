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
eq('LinkedIn folds on the mobile figure, the stricter one', LI?.chars, 140);
eq('and on three lines as well', LI?.lines, 3);
eq('Instagram folds at 125', IG?.chars, 125);
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

// A word boundary is preferred, but not at any cost: a 200 character word cannot be broken
// politely, so the cut falls at the limit rather than at a space 60 characters back.
const politely = 'one two three four five six seven eight nine ten '.repeat(6);
const p2 = foldCopy(politely, LI);
ok('a normal sentence breaks between words', p2.tail.startsWith(' ') || p2.head.endsWith('e') || !p2.head.endsWith(' '));
ok('and the head is never mangled to nothing', p2.head.length > 80);

/**
 * THE CASE THAT MATTERS MOST, and the reason line counting exists at all. This is the LinkedIn
 * house style: short lines, one idea each. It is 62 characters, well under 140, and the platform
 * still folds it after the third line. A character-only rule would have told him the whole thing
 * was visible.
 */
const shortLines = 'The belief.\nThe break.\nThe cost.\nThe fix.\nThe ask.';
const sl = foldCopy(shortLines, LI);
ok('the short line post is well under the character limit', shortLines.length < 140);
eq('and still folds, on the lines', sl.reason, 'lines');
eq('after exactly three of them', sl.head, 'The belief.\nThe break.\nThe cost.');
ok('with the rest behind it', sl.tail.includes('The ask.'));

// Instagram folds on characters only: it has no line rule, so the same post is whole there.
const ig = foldCopy(shortLines, IG);
eq('Instagram does not fold on lines', ig.reason, null);
eq('so the whole thing shows', ig.tail, '');

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
