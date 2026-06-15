/**
 * Machine-readable brand tokens for polynize.ai.
 * Rendered into /brand as a <script type="application/json" id="brand-tokens">
 * block so LLMs and downstream tools can consume the spec directly.
 *
 * Source of truth for:
 *   - Base Polynize palette (from design_handoff/designs/shared/tokens.css)
 *   - Tactile substrate tokens (from TACTILE_DESIGN_LANGUAGE.md)
 *   - Voice + writing rules (from design_handoff/designs/Polynize Brand.html
 *     §03, §04 + CLAUDE.md §2, §3)
 */

export const BRAND_TOKENS = {
  name: 'polynize.ai',
  version: '2.0',
  last_updated: '2026-06-15',
  tagline: '1 human + 4 agents = 5× throughput',
  brand_lines: {
    method: 'Think better',
    payoff: 'Work worth doing',
    ladder: 'Think better, build the team around the human, work worth doing.',
    one_liner:
      'Polynize maps the work, finds the human at its centre, and builds the hybrid team that amplifies them.',
  },

  palette: {
    bg: '#0a0a0f',
    surface: '#13131a',
    surface_2: '#1a1a23',
    text: '#f4ece4',
    text_2: '#c7b9ac',
    text_3: '#8a7d72',
    mint: '#69fccb',
    blue: '#a5c1ec',
    gold: '#f0e1b6',
    coral: '#ff7a6b',
    amber: '#f0b86b',
    border: 'rgba(105, 252, 203, 0.18)',
    border_soft: 'rgba(244, 236, 228, 0.08)',
  },

  allocation_colors: {
    human_led: '#ff7a6b',
    hybrid: '#f0b86b',
    agent_executable: '#69fccb',
    divergence_note:
      'polynize.ai website uses #ff7a6b (coral) / #f0b86b (amber). Agent Team Console app uses #e86a5c (human) / #e8b85c (hybrid). Reconciliation pending. Both resolve to the same semantic (coral = human, amber = hybrid, mint = agent); do not remap.',
  },

  tactile: {
    description:
      'Depth extension. Layers on top of base tokens. Replaces flat 1px borders with carved shadows. Three elevations only: inset, raised, emphasised. Light source invariant: upper-left highlight, lower-right shadow.',
    substrate_dark: {
      tac_bg: '#161620',
      tac_surface: '#1c1c27',
      tac_surface_2: '#22222e',
      tac_inset: '#0f0f17',
      tac_edge_light: 'rgba(255, 255, 255, 0.07)',
      tac_edge_dark: 'rgba(0, 0, 0, 0.55)',
      tac_rim: 'rgba(255, 255, 255, 0.045)',
    },
    substrate_light: {
      tac_bg: '#e8dfd3',
      tac_surface: '#efe7dc',
      tac_surface_2: '#f4ece0',
      tac_inset: '#d8cfc1',
      tac_edge_light: 'rgba(255, 255, 255, 0.90)',
      tac_edge_dark: 'rgba(15, 40, 35, 0.14)',
      tac_rim: 'rgba(255, 255, 255, 0.60)',
    },
    shadow_raised: [
      '0 1px 0 var(--tac-edge-light) inset',
      '0 -1px 0 var(--tac-edge-dark) inset',
      '-6px -6px 14px var(--tac-rim)',
      '8px 8px 20px rgba(0, 0, 0, 0.40)',
      '14px 14px 36px rgba(0, 0, 0, 0.25)',
    ],
    shadow_inset: [
      '2px 2px 5px rgba(0, 0, 0, 0.45) inset',
      '-1px -1px 3px var(--tac-rim) inset',
    ],
    shadow_emphasised: [
      '0 1px 0 var(--tac-edge-light) inset',
      '0 -1px 0 var(--tac-edge-dark) inset',
      '-8px -8px 18px var(--tac-rim)',
      '10px 10px 24px rgba(0, 0, 0, 0.45)',
      '18px 18px 48px rgba(0, 0, 0, 0.3)',
    ],
    shadow_pressed: [
      '2px 2px 5px rgba(0, 0, 0, 0.5) inset',
      '-1px -1px 3px rgba(255, 255, 255, 0.1) inset',
    ],
    button_gradient: 'linear-gradient(180deg, #7fffd2, #3fc99a)',
    button_text: '#0a1a14',
    radii: { card: '18px', button: '12px', input: '12px', pill: '999px' },
    motion: {
      transition: '120ms ease-out',
      hover: 'translate(-1px, -1px) + shadow offsets +1px, blurs +4px',
      pressed: 'translate(0, 1px) + inset shadow',
    },
    texture: {
      felt: 'body::before, inline SVG fractal noise, baseFrequency=1.2, opacity=0.22, mix-blend-mode=overlay',
      brushed_metal:
        'card::after, inline SVG fractal noise, baseFrequency=2, opacity=0.18, mix-blend-mode=overlay',
    },
    anti_patterns: [
      'No glassmorphism / backdrop-filter: blur on cards',
      'No pastel neumorphism (surfaces lighter than page bg)',
      'No flat 1px borders on cards or buttons (edges come from bevel shadows)',
      'No gradient backgrounds on panels (gradients only on primary button + segmented active pill)',
      'No pure black #000 or pure white #fff (always warm #161620 / #e8dfd3)',
      'No symmetric box-shadows (always directional: upper-left highlight + lower-right shadow)',
      'No more than three elevations (inset / raised / emphasised)',
      'No emoji, stock icons, generic SaaS illustrations',
    ],
  },

  typography: {
    display: { family: 'Space Grotesk', weights: [400, 500, 600, 700, 800] },
    body: { family: 'Inter', weights: [400, 500, 600] },
    mono: { family: 'JetBrains Mono', weights: [400, 500] },
    accent: { family: 'Caveat', weights: [400] },
    rules: [
      'Display is for headings and hero copy only',
      'Body handles all prose',
      'Mono is for chrome, metadata, code, labels, never body copy',
      'Never use pure-white text on the dark background; use text (#f4ece4) so glyphs blend with the felt overlay',
    ],
  },

  voice: {
    tone: 'operator-to-operator, direct, business-literate, no hype',
    never_use_em_dashes: true,
    avoid_words: [
      'revolutionize',
      'transform (as verb in hero)',
      'unleash',
      'supercharge',
      'ninja',
      'rockstar',
      'the future of work',
      'assistant',
      'hosting',
      'seamless',
      'empower',
      'game-changer',
      'AI-powered',
      'cutting-edge',
      'best-in-class',
      'synergy',
      'replace people',
      'without headcount',
    ],
    prefer_words: [
      'team',
      'work unit',
      'judgment',
      'execution',
      'capability',
      'outcome',
      'bottleneck',
      'leverage',
      'throughput',
      'agent team',
      'cognitive work unit',
      'human lead',
      'install',
      'deploy',
      'connector',
      'blueprint',
      'capability blueprint',
      'tool-agnostic',
      'benchmark',
    ],
  },

  writing_rules: [
    {
      id: 'R.01',
      rule: 'No em-dashes. Anywhere. Not in site copy, Blueprint content, AI-generated content, or commit messages that render to users.',
      why: 'Use commas, colons, periods, or en-dashes for ranges. Enforce inside every LLM system prompt.',
    },
    {
      id: 'R.02',
      rule: 'Short sentences. Operator-to-operator.',
      why: 'If a sentence runs beyond two lines on mobile, split it.',
    },
    {
      id: 'R.03',
      rule: 'No hype adjectives. No "revolutionary", "game-changing", "next-generation".',
      why: "Describe what the thing does. Let the reader decide if it's revolutionary.",
    },
    {
      id: 'R.04',
      rule: "Use the visitor's language. In the Blueprint, echo their words from Q1 and Q3.",
      why: "Don't substitute generic industry terms when the visitor used specific ones.",
    },
    {
      id: 'R.05',
      rule: 'Name agents with human-sounding names. Not "Agent 1" or "Marketing Assistant".',
      why: 'Names should feel like colleagues. Nora, Arlo, Sena, Jules.',
    },
    {
      id: 'R.06',
      rule: 'Numbers get the gold accent. Everywhere they appear in hero copy, stats, pricing.',
      why: 'Signals that numbers matter and are worth trusting.',
    },
    {
      id: 'R.07',
      rule: 'One CTA per screen. No secondary action competing for attention.',
      why: "The whole funnel is built around 'Map Your Business'. Don't dilute it.",
    },
    {
      id: 'R.08',
      rule: 'Human-first. Never frame outcomes as replacing people, growing without headcount, or doing more with fewer staff. Frame the work as amplifying the human.',
      why: 'We build the team around the human and never cut them out. Amplification is the promise, not headcount reduction.',
    },
  ],

  visual_vocabulary: {
    use: [
      'Deep navy backgrounds',
      'Tactile raised cards with dual-axis shadows',
      'Carved recessed wells for inputs and progress tracks',
      'Generous whitespace',
      'Clean grid layouts',
      'Mono labels for chrome and metadata',
      'Gold for numbers',
      'Subtle staggered animation when grids reveal (~300ms total)',
      'Line-art illustration when illustration is needed (1.5px stroke, currentColor)',
    ],
    avoid: [
      'Stock photography',
      'Aggressive full-page gradient backgrounds',
      'Rounded containers with a coloured left-border stripe (AI-slop tell)',
      'SVG illustrations of "people"',
      'Emoji (unless explicitly part of a campaign)',
      'Overused fonts: Roboto, Arial, Fraunces, system sans',
    ],
  },

  system_prompt_boilerplate: [
    'You are writing as Polynize, the work-design company for the agent era. We blueprint and build agent teams.',
    'Voice: operator-to-operator, direct, business-literate, no hype.',
    'Never use em-dashes (U+2014). Use commas, colons, or periods.',
    'Never use: revolutionize, unleash, supercharge, game-changer, seamless, empower.',
    'Human-first: never frame outcomes as replacing people or cutting headcount. Frame the work as amplifying the human.',
    'Tool-agnostic: the thinking is the product and the tools are interchangeable across any model or platform.',
    'Prefer: judgment, execution, agent team, cognitive work unit, capability blueprint, human lead, benchmark.',
    'Short sentences. No hype. Use the visitor\'s own language from their answers.',
  ].join(' '),
} as const;

export type BrandTokens = typeof BRAND_TOKENS;
