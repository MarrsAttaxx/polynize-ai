/**
 * TELLING APRIL SOMETHING AND HAVING IT STICK (D93).
 *
 * Marrs: "Ideally what I would do is, regardless of where I am in the system, if there's a chat
 * window, I can write `feedback..` and then give some feedback that goes directly to adjusting her
 * function."
 *
 * So: any chat box, his own syntax, and the note outlives the conversation it was typed in.
 *
 * WHY THIS IS IN THE INTERFACE RATHER THAN IN A CODE CHANGE. Every voice tweak going through a
 * developer means waiting on a deploy and on someone's availability, for the thing he will want to
 * adjust most often. And feedback is DATA: the console already treats voice this way, as an editable
 * doc per stream read on every draft.
 *
 * THE WHOLE DESIGN IS ABOUT NOT MAKING APRIL WORSE. A prompt has a signal budget, and a growing pile
 * of one-line notes spends it. This codebase has learned that twice: D26 compressed the hook library
 * to adjectives and the writing got worse, and the fix was to restore examples and cut wordage
 * elsewhere. So every decision below is biased toward FEW, STRONG, SCOPED notes rather than a
 * complete record of everything ever said.
 *
 * FOUR RULES, each one a thing that would otherwise go wrong:
 *
 * 1. SCOPE IS LOAD-BEARING, and it is a JOB rather than a screen. A note about hook labelling should
 *    apply wherever hooks are proposed, not on the one url he happened to be looking at. A screen is
 *    a place; a job is what April was doing, and that is what the note is about.
 *
 * 2. IT FAILS NARROW. An ambiguous note lands on the job he was looking at, never on the house,
 *    because a narrow note applied everywhere does damage while a global note stored narrowly just
 *    needs widening once. Widening is one click in the review screen; un-damaging every piece of
 *    copy in the system is not.
 *
 * 3. THE SCOPE IS SAID OUT LOUD when the note is taken. An invisible scope choice is the same class
 *    of mistake as the YouTube title nobody could see (D82): a derived value the operator cannot
 *    check is a guess with extra steps.
 *
 * 4. A NOTE CANNOT FIX A BUG, so it must be possible to say "this is a defect". Both of his first
 *    two examples proved this: "don't instead of do not" was a missing house rule, and the hook
 *    labels were a prompt contradicting itself (D91). A note for the second would have papered over
 *    a bug and left April told two opposite things. Defects are recorded and NOT injected.
 *
 * PURE, so every rule above is asserted in tests rather than trusted, and so the review screen can
 * import it without dragging a store into the browser.
 */

/**
 * WHAT APRIL WAS DOING, which is the third scope.
 *
 * These are the prose prompt paths as they exist, not an invented taxonomy: each one is a real
 * builder in draft.ts or article-draft.ts, or a chat route. A note attaches to one of them.
 */
export const JOBS = [
  { id: 'hooks', label: 'Proposing hooks' },
  { id: 'outline', label: 'Proposing the arc' },
  { id: 'script', label: 'Writing a video script' },
  { id: 'copy', label: 'Writing post copy' },
  { id: 'article', label: 'Writing the article' },
  { id: 'edit', label: 'Editing on instruction' },
] as const;

export type JobId = (typeof JOBS)[number]['id'];

export function isJobId(x: unknown): x is JobId {
  return typeof x === 'string' && JOBS.some((j) => j.id === x);
}

export function jobLabel(id: string): string {
  return JOBS.find((j) => j.id === id)?.label ?? id;
}

export type FeedbackScope = 'house' | 'stream' | 'job';

export type FeedbackNote = {
  id: string;
  /** ISO instant. */
  at: string;
  /** The signed-in email, so a note has an author. */
  by: string;
  /** His words, never rewritten. */
  text: string;
  scope: FeedbackScope;
  /** Set when scope is 'stream'. */
  stream?: string;
  /** Set when scope is 'job'. */
  job?: JobId;
  /**
   * A RULE IS APPLIED; A DEFECT IS NOT.
   *
   * See rule 4 at the top. Marking a note a defect takes it out of every prompt and puts it on a
   * list to be fixed in code, because an instruction cannot undo a contradiction: April would be
   * told two opposite things and pick one.
   */
  kind: 'rule' | 'defect';
  /** Set when retired, so history survives and the prompt does not. */
  retired_at?: string;
  /** Where it was typed, for the review screen: the piece or narrative id. */
  from?: string;
};

/* ------------------------------------------------------------------ catching it */

/**
 * HIS SYNTAX, GENEROUSLY READ. He dictates, and dictation mangles punctuation: "feedback dot dot"
 * arrives as `feedback..`, `feedback.`, `feedback:` or `feedback ,`. All of them mean the same
 * thing, and a prefix that only works when typed perfectly is a prefix that fails the one time it
 * matters.
 *
 * The word must START the message, though. "Some feedback on this draft" is a normal instruction and
 * turning it into a stored rule would be worse than missing it.
 */
const PREFIX = /^\s*feed\s?back\b[\s.:,;-]*/i;

/** Words that mean "this applies everywhere", so he can widen without leaving the chat box. */
const GLOBAL_MARKERS =
  /\b(everywhere|globally|global|all streams|every stream|house rule|in general|always|from now on|across the board)\b/i;

/** "for marrs", "on the polynize stream": widening to a named stream without leaving the box. */
function namedStream(text: string, streams: readonly string[]): string | undefined {
  for (const s of streams) {
    if (new RegExp(`\\b(for|on|to)\\s+(the\\s+)?${s}\\b`, 'i').test(text)) return s;
  }
  return undefined;
}

export type FeedbackContext = {
  /** The stream the operator is looking at, when there is one. */
  stream?: string;
  /** What April was doing on this screen. */
  job?: JobId;
  /** The piece or narrative the note came from. */
  from?: string;
  /** Known stream ids, so "for kristin" can be recognised without importing the stream list. */
  streams?: readonly string[];
};

export type Caught = {
  text: string;
  scope: FeedbackScope;
  stream?: string;
  job?: JobId;
  from?: string;
  /** Said back to him, because a scope he cannot see is a scope he cannot correct. */
  said: string;
};

/**
 * Is this message feedback, and if so what does it apply to?
 *
 * Returns null for an ordinary instruction, which is the common case and must stay untouched.
 */
export function catchFeedback(instruction: string, ctx: FeedbackContext = {}): Caught | null {
  if (!PREFIX.test(instruction)) return null;
  const text = instruction.replace(PREFIX, '').trim();
  /**
   * "feedback.." AND NOTHING ELSE is not a note. Storing an empty rule would put a blank line in
   * every prompt, and telling him it was saved would be a lie.
   */
  if (text.length < 3) return null;

  const named = namedStream(text, ctx.streams ?? []);
  if (named) {
    return {
      text,
      scope: 'stream',
      stream: named,
      from: ctx.from,
      said: `Saved as a rule for the ${named} stream.`,
    };
  }
  if (GLOBAL_MARKERS.test(text)) {
    return {
      text,
      scope: 'house',
      from: ctx.from,
      said: 'Saved as a house rule, so it applies to everything April writes.',
    };
  }
  /**
   * FAILING NARROW (rule 2). With a job in context the note lands on the job; with none it lands on
   * the stream; only an explicit marker reaches the house.
   */
  if (ctx.job) {
    return {
      text,
      scope: 'job',
      job: ctx.job,
      stream: ctx.stream,
      from: ctx.from,
      said: `Saved for "${jobLabel(ctx.job).toLowerCase()}". Say "everywhere" to make it a house rule, or widen it on the Feedback screen.`,
    };
  }
  if (ctx.stream) {
    return {
      text,
      scope: 'stream',
      stream: ctx.stream,
      from: ctx.from,
      said: `Saved as a rule for the ${ctx.stream} stream. Say "everywhere" to make it a house rule.`,
    };
  }
  return {
    text,
    scope: 'house',
    from: ctx.from,
    said: 'Saved as a house rule, since there was no piece or stream in view to attach it to.',
  };
}

/* ------------------------------------------------------------------ giving it to her */

/**
 * HOW MANY NOTES REACH ONE PROMPT, per scope.
 *
 * Eight is deliberately generous for what he will actually have (two to five) and deliberately
 * finite. NOT a newest-first window: silently retiring his oldest and most established preference to
 * make room for today's aside is the worst possible behaviour, because the note he would most want
 * kept is the one that has been true longest.
 *
 * So the cap REFUSES rather than rotates, the refusal is visible on the review screen, and curating
 * is his to do. A limit that quietly drops things is a limit nobody can plan around.
 */
export const NOTES_PER_SCOPE = 8;

export type Applied = {
  /** In the order they will be shown to April: house, then stream, then job. */
  notes: FeedbackNote[];
  /** Notes that matched but did not fit the cap, so the screen can say so. */
  overflow: FeedbackNote[];
};

/**
 * Which notes apply to this piece of work.
 *
 * A defect is never applied, and a retired note never applies. Both are still stored: the point of
 * keeping them is that the review screen can show what was said and what happened to it.
 */
export function applyTo(
  all: readonly FeedbackNote[],
  ctx: { stream?: string; job?: JobId }
): Applied {
  const live = all.filter((n) => !n.retired_at && n.kind === 'rule');
  const pick = (want: (n: FeedbackNote) => boolean) => {
    const matched = live.filter(want).sort((a, b) => (a.at < b.at ? -1 : 1));
    return { keep: matched.slice(0, NOTES_PER_SCOPE), over: matched.slice(NOTES_PER_SCOPE) };
  };

  const house = pick((n) => n.scope === 'house');
  const stream = ctx.stream
    ? pick((n) => n.scope === 'stream' && n.stream === ctx.stream)
    : { keep: [], over: [] };
  const job = ctx.job ? pick((n) => n.scope === 'job' && n.job === ctx.job) : { keep: [], over: [] };

  return {
    notes: [...house.keep, ...stream.keep, ...job.keep],
    overflow: [...house.over, ...stream.over, ...job.over],
  };
}

/**
 * The block April reads. Empty string when there is nothing, so a prompt with no feedback is byte
 * for byte the prompt it was before this existed.
 *
 * WHY IT SAYS WHERE EACH NOTE CAME FROM. A flat list of rules is a list a model weighs equally. Told
 * that one is a standing house rule and another is specific to this job, it can resolve a clash the
 * way the operator would. And it is honest: these are HIS corrections, not house craft, so they are
 * labelled as corrections and given the last word.
 */
export function feedbackBlock(applied: Applied): string {
  if (applied.notes.length === 0) return '';
  const line = (n: FeedbackNote) => {
    const where =
      n.scope === 'house'
        ? 'always'
        : n.scope === 'stream'
          ? `on the ${n.stream} stream`
          : `when ${jobLabel(n.job ?? '').toLowerCase()}`;
    return `- (${where}) ${n.text}`;
  };
  return `\n\nCORRECTIONS FROM THE OPERATOR. These are things he has told you directly after reading your work, so they carry more weight than the general guidance above and they override it wherever the two differ. Apply every one that is relevant to what you are writing now.\n${applied.notes
    .map(line)
    .join('\n')}`;
}
