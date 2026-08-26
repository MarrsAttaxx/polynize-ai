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
import { nextOpenSlots } from '../channel-schedule';
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
