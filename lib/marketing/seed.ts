/**
 * Phase-1 seed content: the "Strip the AI out first" short-form piece.
 *
 * Marrs's own short-form script from the alpha, used to seed the Script screen
 * so Phase 1 has real content before the concept bank is wired. Once the
 * concept bank (bucket) + April are live, seeds come from there instead.
 * (No em-dashes, per the brand rule.)
 */

import type { MarketingPiece } from './piece-store';

export const SEED_PIECES: Record<string, Omit<MarketingPiece, 'owner'>> = {
  'strip-the-ai-out-first': {
    piece_id: 'strip-the-ai-out-first',
    format: 'short_form_video',
    title: 'Strip the AI out first',
    concept_ref: 'capability-mapping/strip-the-ai-out-first',
    pillar: 'thesis',
    stage: 'script',
    script: [
      'HOOK (contrarian)',
      "Stop looking at the AI. It's the worst place to start.",
      '',
      'BEAT 1 · the trap',
      "Every business owner with a bottleneck right now is reaching for an AI tool to fix it. That feels like progress. It's actually the mistake.",
      '',
      'BEAT 2 · the cost',
      '95% of the first wave of AI integration failed. Not because the tools were bad. Because people applied an agent to a problem they had not even defined yet. When your agent is only 80% right, your team rejects it. Every time.',
      '',
      'BEAT 3 · the move',
      'The move is to strip the AI out completely. Forget it exists for a minute. Look at the bare work. Take the one bottleneck choking your business and break it into its capabilities, the atomic units of the actual work. Then decide: which of these is human, which is hybrid, which can an agent run entirely.',
      '',
      'BEAT 4 · the unlock',
      'Here is the thing nobody tells you. "What does good look like?" is completely unanswerable at the business level. The moment you break it to one capability, say triaging inbound email, you can suddenly answer it with total clarity. The decomposition creates the clarity. That is the whole special sauce.',
      '',
      'BEAT 5 · the close',
      "Everyone agrees with this the moment they see it. The problem is nobody has shown them the move exists. Map the work. Find the human. Then add the agents. That's the order.",
      '',
      'CTA',
      "Go to polynize.ai and hit Map Your Bottleneck. In about five minutes you'll see your own business mapped: what stays human, what's hybrid, what an agent can run. Once you see it, you can't unsee it. Link's in the bio.",
    ].join('\n'),
  },
};
