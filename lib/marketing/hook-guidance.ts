/**
 * Hook + curiosity-gap guidance injected into April's copy and script prompts.
 *
 * WHY THIS FILE GOT MUCH LONGER, 2026-08-12.
 *
 * Marrs: "I'm generating split-screen scripts from the core concept of capability mapping
 * and they're really bad. The hooks are bad and the beats aren't great."
 *
 * The previous version of this file was an eight-bullet distillation of the two canonical
 * skill docs, written under D26 to be "tight enough to inject into a system prompt without
 * bloating it". In compressing it, it kept every RULE and discarded every EXAMPLE, along
 * with the whole seven-pattern library. That is exactly backwards. The rules are the
 * compressible part. "Be concrete, not abstract" is an adjective a model satisfies
 * superficially and then writes abstractly anyway; a named pattern with a model line beside
 * it is something it can imitate.
 *
 * The canonical doc even predicted this failure by name. Its opening line is: 'A hook like
 * "This is why capability mapping matters" is dead on arrival.' Capability mapping is the
 * concept Marrs was drafting from.
 *
 * Source of truth remains docs/pam-console/april-skills/hook-writing-v1.0.md and
 * curiosity-gap.md. This is a faithful carry of the parts a writer cannot reconstruct from
 * a rule: the pattern library, the paired-hook example, the worked fixes, and the gate.
 */

export const HOOK_GUIDANCE = `HOOK CRAFT. The hook is the highest-leverage line in the piece, because reach comes from completion, shares and sends, not likes. A hook that opens a real loop makes people watch to the end. Treat it as the line you spend the most effort on.

THE FIVE RULES.
1. CONTEXT-COMPLETE, and this is the one that fails most. The hook must make full sense to someone who has never heard of Polynize, of agents, or of the topic. No unexplained jargon. No "this", "that" or "it" pointing at something the viewer cannot see. No assuming prior knowledge. If understanding the hook requires already knowing the concept, it has failed. Name the tension in plain words a stranger gets instantly.
2. CONCRETE, NOT ABSTRACT. "Most companies are about to waste millions on AI" beats "AI adoption has challenges."
3. ONE OPEN LOOP. Exactly one question the piece then answers. Two ideas in a hook is zero hooks.
4. CURIOSITY GAP WITH A REAL PAYOFF. Reveal enough that they care and grasp the stakes, withhold the one thing they now need. The piece must actually deliver it. No bait.
5. IN VOICE AND OWNABLE. Operator to operator, direct, an edge. If a competitor could post the identical line, sharpen the point of view. No corporate filler, no "unlock", no "in today's fast-paced world", no em-dashes.

THE PATTERN LIBRARY. Pick a pattern deliberately, then write to it. Each example below is intelligible cold to a stranger, which is rule 1 doing its job.
- CONTRARIAN REFRAME (the signature move): state the common belief, then break it. "Everyone starts their AI project by picking a tool. That is exactly why most of them fail."
- COSTLY-MISTAKE CALLOUT: name a mistake the viewer is probably making, and what it costs. "You are using AI backwards, and it is quietly costing you your best people."
- CURIOSITY-GAP QUESTION: ask something they cannot answer but want to. "Why did 95% of last year's enterprise AI projects get quietly shut down?"
- NAMED-NUMBER PROOF: lead with a concrete, surprising number. "Nineteen out of twenty AI rollouts failed last year. The pattern behind it is always the same."
- PROVOCATIVE IMAGE: one vivid concrete picture carrying the tension. "Your most talented employee spends half their day copying data between spreadsheets. That is the real crime of modern work."
- EARNED AUTHORITY: specific lived credibility, then tease the lesson. "I have built agent teams inside real businesses. Here is the one thing nobody selling AI will tell you."
- REFRAME BY ANALOGY: reframe the topic through one unexpected comparison. "When tractors arrived, we did not mourn the lost farm labour. So why are we panicking about AI taking the work humans were never meant to do?"

TWO HOOKS FOR SHORT-FORM VIDEO, doing different jobs. The TEXT hook is the first-frame caption, read before the speaker is heard, and it does the scroll-stop. The VERBAL hook is the first spoken line and carries the argument's opening. They must NOT be the same words: if they are identical, one is wasted.
Worked pairing:
- Text hook, on screen: "95% of AI projects fail."
- Verbal hook, spoken: "And it is almost never because the technology was bad."
Together they open a loop the text alone could not.

WHEN ASKED FOR SEVERAL HOOKS, give a spread that uses DIFFERENT PATTERNS from the library, not one idea reworded. Three rewordings of the same thought is the most common failure and it is not allowed.

WHAT A COLD-AUDIENCE FIX ACTUALLY LOOKS LIKE. These are real hooks that failed and the rewrite of each. Study the move, because it is the exact habit to avoid.
- Failed: "You are the bottleneck in your AI stack." It assumes the viewer knows what an AI stack is and that they have one, and gives no concrete picture. Fixed: "You bought all the AI tools. So why does everything still funnel through you?"
- Failed: "Stop managing twenty agents. Hire a CTO agent." Three layers of assumed knowledge: that they run many agents, what managing them means, what a CTO agent is. Fixed: "Most people using AI now spend more time managing the AI than doing the work. That is backwards."
- Failed: "Adding more AI agents is making you slower, not faster." Still assumes the viewer is already adding agents, so a stranger has no way in.

THE GATE. Before you commit to a hook, run it and rewrite anything that fails.
1. Cold-reader: would someone who has never heard of this topic understand it in one read? Enforce this hardest.
2. Loop: does it open a clear question they need answered?
3. Concrete: is there a specific image, number or named tension, or is it vague?
4. First words: do the first three or four words already earn attention, or is it warming up? Cut any run-up.
5. One idea: is it about exactly one thing?
6. Ownable: could a competitor post this identical line?
7. Voice: operator to operator, an edge, no em-dash, Australian spelling, no filler.
8. Payoff: does the piece deliver what the hook promises?`;
