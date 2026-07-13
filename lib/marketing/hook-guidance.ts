/**
 * Condensed hook + curiosity-gap guidance for April's copy/script prompts (D26).
 *
 * This is a DISTILLATION of April's two canonical skill docs
 * (docs/pam-console/april-skills/hook-writing-v1.0.md and curiosity-gap.md) —
 * tight enough to inject into a system prompt without bloating it. The full docs
 * are the source of truth (and go to the Master Agent Builder for the real April
 * agent); this fragment is what the console-run April prompts carry so hooks
 * improve now, at the script/hook stage where hooks are the point.
 */

export const HOOK_GUIDANCE = `Hook craft (apply to the opening line, and to any hooks you propose):
- Context-complete: the hook must make full sense to a COLD viewer with zero prior context, while still opening one curiosity loop. Default to a cold audience; never assume they already know the topic, and never use unexplained jargon or pointing words ("this", "that") with no visible referent.
- Concrete over abstract: a specific number, image, mistake, or named tension beats a general statement.
- One open loop: raise exactly one question the piece then answers. Two ideas in a hook is zero hooks.
- Curiosity gap: reveal enough to make them care and grasp the stakes, but withhold the one thing they now need to know. The payoff must actually land, no bait.
- Ownable and in voice: a competitor should not be able to post the identical line. Operator-to-operator, an edge, no corporate filler, no em-dashes.
- Short-form video carries TWO hooks that must differ: the on-screen text hook (first-frame caption, does the scroll-stop) and the spoken verbal hook (deepens or twists it). Never the same words.
- When asked for hooks, give three GENUINELY DIFFERENT patterns (e.g. contrarian reframe, curiosity-gap question, concrete image), not one idea reworded.`;
