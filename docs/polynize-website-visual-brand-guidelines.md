# Polynize Website — Visual Brand Guidelines

A self-contained spec for reproducing the **polynize.ai public website's** visual
language. Every value below is extracted verbatim from the website source (not
the PAM Console, not the blueprint views).

**Extracted from:**
- `app/globals.css` — canonical brand tokens (the `:root` palette)
- `app/tactile.css` — the depth substrate: page background, ambient glows, grain overlay, shadow recipes
- `app/layout.tsx` — font loading (`next/font/google`) and `data-depth="tactile"` on `<body>`
- `app/_components/drafting-grid.module.css` + `app/_components/DraftingGrid.tsx` — the signature blueprint grid
- `app/_home/home.module.css` — the homepage ("Direction C"): palette overrides, surfaces, glows, gradients, shadows, type
- `app/page.tsx` — how the layers stack
- `app/brand/page.tsx` — the on-site brand reference (font + palette roles)

---

## 0. Read this first: the two-layer palette

The site has a **canonical brand palette** (declared in `globals.css`, shown on
the `/brand` page) and the **homepage's active palette** ("Direction C", a
warm-shifted override applied by the `.dirC` wrapper in `home.module.css`). The
homepage is what a visitor actually sees, so **to reproduce the website's look,
use the Direction C values** — but both are documented so the relationship is
explicit. A subtlety worth keeping: the *structural* glow/grid mint is the
canonical `#69fccb` (`rgba(105,252,203,…)`), while the *accent* mint used for
text, cells and buttons on the homepage is Direction C's `#4de8a0`. Both appear
on screen deliberately.

Stacking order on the homepage (bottom → top), from `page.tsx` + the CSS:

```
<body data-depth="tactile">           ← warm-navy substrate + ambient radial glows (tactile.css)
  body::before                        ← fixed grain overlay (tactile.css, mix-blend overlay, opacity .22)
  <DraftingGrid />                    ← fixed blueprint grid, z-index 0 (drafting-grid.module.css)
  <div class="dirC">                  ← z-index 1, isolate; adds two corner radial glows; holds all content
     ...page content...
```

---

## 1. Colours

### 1a. Canonical brand tokens — `app/globals.css` `:root`

```css
:root {
  --bg: #0a0a0f;          /* page background (base brand) */
  --surface: #13131a;     /* card, panel */
  --surface-2: #1a1a23;   /* lifted card */
  --mint: #69fccb;        /* primary accent, CTA, "agent" */
  --blue: #a5c1ec;        /* supporting accent */
  --gold: #f0e1b6;        /* numbers, data */
  --text: #f4ece4;        /* primary text (warm off-white, never pure white) */
  --text-2: #c7b9ac;      /* secondary text */
  --text-3: #8a7d72;      /* muted text */
  --border: rgba(105, 252, 203, 0.18);    /* mint hairline border */
  --border-soft: rgba(244, 236, 228, 0.08);
  --coral: #ff7a6b;       /* "human" allocation */
  --amber: #f0b86b;       /* "hybrid" allocation */
}
```

### 1b. Homepage active overrides — `app/_home/home.module.css` `.dirC`

These override the canonical tokens for everything inside the homepage wrapper.
**Use these to match the live homepage.**

```css
.dirC {
  /* Accent palette (warm-shifted vs the canonical tokens) */
  --coral: #e87a4d;
  --amber: #e8c44d;
  --mint:  #4de8a0;

  /* Warm-shifted substrate + surfaces */
  --bg:        #161620;   /* warm navy (replaces #0a0a0f on the homepage) */
  --bg-tint:   #1c1c28;
  --bg-deep:   #0f0f17;   /* recessed wells, nav, insets */
  --surface:   #1d1d29;   /* default raised card */
  --surface-2: #232331;   /* hover / lifted */
  --surface-3: #2a2a39;

  --hairline:        rgba(244, 236, 228, 0.05);  /* divider lines */
  --hairline-strong: rgba(244, 236, 228, 0.10);
  --mint-glow:       rgba(105, 252, 203, 0.18);  /* note: canonical mint */
}
```

Text tokens (`--text #f4ece4`, `--text-2 #c7b9ac`, `--text-3 #8a7d72`), `--gold
#f0e1b6`, `--blue #a5c1ec`, `--border` and `--border-soft` are **not** overridden
— Direction C inherits them from `globals.css`.

### 1c. Allocation colour tokens — `globals.css` (semantic: coral = human, amber = hybrid, mint = agent)

```css
.alloc-human  { color: var(--coral); --alloc-bg: rgba(255,122,107,0.12); --alloc-bd: rgba(255,122,107,0.38); }
.alloc-hybrid { color: var(--amber); --alloc-bg: rgba(240,184,107,0.12); --alloc-bd: rgba(240,184,107,0.38); }
.alloc-agent  { color: var(--mint);  --alloc-bg: rgba(105,252,203,0.12); --alloc-bd: rgba(105,252,203,0.38); }
```

On the homepage, the live capability-map cells use the Direction C accents at
0.6 alpha fill (see §6).

---

## 2. Background treatments (the signature look)

Four layers combine. Reproduce all four for the real effect.

### 2a. Page substrate + ambient corner glows — `tactile.css` (`body[data-depth="tactile"]`)

Warm navy base with two soft radial glows (amber top-right, mint bottom-left):

```css
body[data-depth="tactile"] {
  --tac-bg: #161620;
  background:
    radial-gradient(ellipse 900px 500px at 80% -10%, rgba(232, 184, 92, 0.05), transparent 60%),
    radial-gradient(ellipse 900px 500px at 20% 110%, rgba(105, 252, 203, 0.04), transparent 60%),
    var(--tac-bg);
  min-height: 100vh;
}
```

### 2b. The blueprint drafting grid — `drafting-grid.module.css` (THE signature element)

A faint mint orthogonal grid at **80px pitch**, drawn with two
`repeating-linear-gradient`s (1px line every 80px), fixed to the viewport behind
content. Line colour is the canonical mint at **5.5% alpha**.

```css
.grid {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    /* Horizontal lines — 80px pitch */
    repeating-linear-gradient(
      0deg,
      transparent 0,
      transparent 79px,
      rgba(105, 252, 203, 0.055) 79px,
      rgba(105, 252, 203, 0.055) 80px
    ),
    /* Vertical lines — 80px pitch */
    repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent 79px,
      rgba(105, 252, 203, 0.055) 79px,
      rgba(105, 252, 203, 0.055) 80px
    );
}
```

Rendered as a fixed full-viewport `<div aria-hidden>` behind the content wrapper.
The content wrapper must establish a stacking context above it (the homepage uses
`isolation: isolate; z-index: 1` — see §2d).

### 2c. Direction C corner glows — `home.module.css` `.dirC background`

The homepage wrapper adds two more radial glows over the substrate + grid (gold
top-left, mint bottom-right). The opaque base is intentionally omitted so the
grid shows through:

```css
.dirC {
  background:
    radial-gradient(circle at 12% 8%,  rgba(240, 225, 182, 0.045), transparent 45%),
    radial-gradient(circle at 88% 92%, rgba(105, 252, 203, 0.04),  transparent 50%);
  position: relative;
  isolation: isolate;
  z-index: 1;           /* sits above the fixed grid (z-index 0) */
  min-height: 100vh;
  overflow-x: hidden;
}
```

### 2d. Grain / noise overlay — `tactile.css` (`body::before`)

A fine fractal-noise grain across the whole viewport, applied via an inline SVG
`feTurbulence`, blended with `mix-blend-mode: overlay` at low opacity. (The
homepage's primary texture is the drafting grid in §2b; this body-level grain is
a subtle secondary layer still defined in `tactile.css`.)

```css
body[data-depth="tactile"]::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='2' stitchTiles='stitch' seed='5'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  opacity: 0.22;
  mix-blend-mode: overlay;
}
```

### 2e. Optional card grain — `tactile.css` (`.tacCardTexture::after`)

A finer brushed-metal grain for individual cards (opt-in by adding the class to a
`position: relative` card):

```css
.tacCardTexture::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='2' numOctaves='2' stitchTiles='stitch' seed='3'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.45 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  opacity: 0.18;
  mix-blend-mode: overlay;
}
```

---

## 3. Gradients (every gradient on the site)

### 3a. Primary CTA button — `home.module.css` `.dcBtnPrimary`
```css
background: linear-gradient(180deg, #7fffd4 0%, #69fccb 50%, #4de0ad 100%);
color: #0a0a0f;
```

### 3b. Tactile primary button (substrate recipe) — `tactile.css`
```css
--tac-button-gradient: linear-gradient(180deg, #7fffd2, #3fc99a);
--tac-button-text: #0a1a14;
```

### 3c. Ambient page glows (radial) — see §2a (substrate) and §2c (Direction C corner glows).

### 3d. Accent edge strips (thin gradient bars on cards/sections) — `home.module.css`
```css
/* Map frame top strip (horizontal, fades both ends) */
.dcMapStrip   { background: linear-gradient(90deg, transparent, var(--mint) 30%, var(--mint) 70%, transparent); opacity: 0.55; }
/* Final CTA top strip */
.dcFinalStrip { background: linear-gradient(90deg, transparent, var(--mint), transparent); }
/* Left accent strips (vertical, fades down) */
.dcMidCta::before { background: linear-gradient(180deg, var(--mint), transparent); }   /* 3px wide */
.dcQuoteStrip     { background: linear-gradient(180deg, var(--mint), transparent); }   /* 4px wide */
```

### 3e. Hero equation card accent bars — `home.module.css`
```css
.dcEqCardGold::after { background: linear-gradient(90deg, var(--gold), transparent); }
.dcEqCardMint::after { background: linear-gradient(90deg, var(--mint), transparent); }
.dcEqCardOut::after  { background: linear-gradient(90deg, var(--blue), transparent); }
```

### 3f. Final CTA card — radial bloom over the surface — `home.module.css` `.dcFinalCard`
```css
background:
  radial-gradient(circle at 50% 0%, rgba(105, 252, 203, 0.10), transparent 60%),
  var(--surface);
```

---

## 4. Typography

Loaded via `next/font/google` in `app/layout.tsx` (self-hosted at build). The
`<html>` element carries the three CSS variables; `<body>` defaults to Inter.

```ts
// app/layout.tsx
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-space-grotesk', display: 'swap' });
const inter        = Inter({        subsets: ['latin'], weight: ['400','500'],               variable: '--font-inter',         display: 'swap' });
const jetbrainsMono= JetBrains_Mono({subsets: ['latin'], weight: ['400','500'],              variable: '--font-jetbrains-mono', display: 'swap' });

// <html className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
//   <body data-depth="tactile">
```

**Equivalent Google Fonts import** (if not using next/font):
```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap');
```

| Role | Family (CSS variable) | Weights loaded | Where applied |
|---|---|---|---|
| **Display / headings** | Space Grotesk (`--font-space-grotesk`) | 400, 500, 600, 700 | `h1, h2, h3`, wordmark, buttons, big numbers (equation, totals), quote text + mark, card titles, section meta values |
| **Body** | Inter (`--font-inter`) | 400, 500 | `body` default, ledes, descriptions, paragraphs |
| **Mono / chrome** | JetBrains Mono (`--font-jetbrains-mono`) | 400, 500 | row numbers, runtime chips, step numbers, monospace labels |

```css
/* globals.css */ body { font-family: var(--font-inter), ui-sans-serif, system-ui, sans-serif; }
/* home.module.css */ .dirC h1, .dirC h2, .dirC h3 { font-family: var(--font-space-grotesk), 'Space Grotesk', sans-serif; }
```

Note: the on-site `/brand` reference lists Inter as 400/500/600, but the loaded
config (the real source) is **400/500** — use 400/500.

**Heading sizing** (fluid `clamp`, `home.module.css`):
```css
.dcH1         { font-size: clamp(44px, 5.6vw, 84px); font-weight: 600; letter-spacing: -0.04em;  line-height: 0.96; }
.dcH2         { font-size: clamp(32px, 3.6vw, 48px); font-weight: 600; letter-spacing: -0.03em;  line-height: 1.05; }
.dcFinalTitle { font-size: clamp(38px, 5vw,   64px); font-weight: 600; letter-spacing: -0.035em; line-height: 0.98; }
.dcLede       { font-size: 18px; line-height: 1.55; color: var(--text-2); }
/* Eyebrow labels */
.dcSectionEyebrow { font-size: 12px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--mint); }
```

---

## 5. Shadows, borders, radius

### 5a. Shadow recipes — homepage (`home.module.css` `.dirC`)

The premium "carved" feel is pure layered `box-shadow` (inset highlight top-left,
inset shadow bottom-right, plus drop shadows). **No blur is used.**

```css
--raise:
  inset 1px 1px 0 rgba(255, 255, 255, 0.05),
  inset -1px -1px 0 rgba(0, 0, 0, 0.4),
  -2px -2px 6px rgba(255, 255, 255, 0.015),
  8px 10px 20px rgba(0, 0, 0, 0.5),
  16px 22px 44px rgba(0, 0, 0, 0.4);

--inset:
  inset 3px 3px 8px rgba(0, 0, 0, 0.55),
  inset -2px -2px 6px rgba(255, 255, 255, 0.025);

--inset-soft:
  inset 2px 2px 5px rgba(0, 0, 0, 0.4),
  inset -1px -1px 3px rgba(255, 255, 255, 0.02);

--emph:   /* emphasised / hero cards */
  inset 1px 1px 0 rgba(255, 255, 255, 0.07),
  inset -1px -1px 0 rgba(0, 0, 0, 0.5),
  -3px -3px 8px rgba(255, 255, 255, 0.02),
  12px 16px 32px rgba(0, 0, 0, 0.6),
  28px 38px 80px rgba(0, 0, 0, 0.55);
```

Usage: raised cards → `box-shadow: var(--raise)`; recessed wells / tables / inset
icons → `var(--inset)` or `var(--inset-soft)`; hero / quote / final cards →
`var(--emph)`.

### 5b. Shadow recipes — tactile substrate (`tactile.css`, the broader system)

```css
--tac-edge-light: rgba(255, 255, 255, 0.07);
--tac-edge-dark:  rgba(0, 0, 0, 0.55);
--tac-rim:        rgba(255, 255, 255, 0.045);

--tac-shadow-raised:
  0 1px 0 var(--tac-edge-light) inset,
  0 -1px 0 var(--tac-edge-dark) inset,
  -6px -6px 14px var(--tac-rim),
  8px 8px 20px rgba(0, 0, 0, 0.4),
  14px 14px 36px rgba(0, 0, 0, 0.25);

--tac-shadow-inset:
  2px 2px 5px rgba(0, 0, 0, 0.45) inset,
  -1px -1px 3px var(--tac-rim) inset;

--tac-shadow-button-primary:
  0 1px 0 rgba(255, 255, 255, 0.55) inset,
  0 -1px 0 rgba(0, 0, 0, 0.25) inset,
  -2px -2px 5px rgba(255, 255, 255, 0.08),
  3px 3px 8px rgba(0, 0, 0, 0.45),
  0 0 18px rgba(105, 252, 203, 0.35);   /* mint outer glow on primary buttons */
```
(Also defined: `--tac-shadow-raised-soft`, `--tac-shadow-emphasised`,
`--tac-shadow-progress-fill`, `--tac-shadow-pressed`, `--tac-shadow-secondary`.)

### 5c. Primary button shadow (homepage) — `.dcBtnPrimary`
```css
box-shadow:
  inset 0 1px 0 rgba(255, 255, 255, 0.25),
  inset 0 -1px 0 rgba(0, 0, 0, 0.15),
  0 2px 4px rgba(0, 0, 0, 0.3),
  0 8px 18px -6px rgba(0, 0, 0, 0.5),
  0 0 12px rgba(105, 252, 203, 0.15);   /* mint glow; intensifies to 0.25 on hover */
```

### 5d. Borders
```css
--border: rgba(105, 252, 203, 0.18);        /* mint hairline (globals) */
--border-soft: rgba(244, 236, 228, 0.08);   /* neutral hairline (globals) */
--hairline: rgba(244, 236, 228, 0.05);       /* divider lines (Direction C) */
--hairline-strong: rgba(244, 236, 228, 0.10);
/* Dividers on the homepage are: border-bottom: 1px solid var(--hairline); */
/* Mint focus ring (globals): :focus-visible { outline: 2px solid var(--mint); outline-offset: 2px; } */
```

### 5e. Border-radius scale (as used)
| Element | radius |
|---|---|
| Final CTA card | `28px` |
| Map frame / quote card | `22px` |
| Mid-CTA / how-it-works cards / podcast feature | `18px` |
| Hero equation card | `16px` |
| Icon tiles / map table | `14px` |
| Podcast mini cards | `12px` |
| Buttons | `11px` |
| "all episodes" button | `10px` |
| Logo mark | `7px` |
| Capability cells | `3px` |
| Pills / eyebrows / avatars | `999px` / `50%` |

---

## 6. Other signature visual effects

- **No `backdrop-filter` / blur anywhere on the site.** All depth comes from
  layered `box-shadow` (inset highlight + inset shadow + drop shadows). Reproduce
  the depth with shadows, not blur.

- **Transitions / motion** (deliberately quick + weighty):
  ```css
  /* tactile.css */ --tac-transition: 120ms ease-out;   /* reduced-motion → 0.001ms */
  /* buttons */     transition: transform 0.15s ease, box-shadow 0.2s ease, background 0.2s;
  ```
  Button hover lifts `transform: translateY(-1px)` and deepens the shadow + mint
  glow; `:active` presses to `translateY(1px)` with an inset shadow. Cards lift
  `translateY(-2px)` on hover. The CTA arrow nudges `translateX(3px)` on hover.

- **Capability-map cell glow recipe** (three layers — the brand's data signature;
  states: coral = human, amber = hybrid, mint = agent). Inactive cells are a
  6%-opacity hairline with no fill:
  ```css
  .dcMapCell { height: 28px; border: 1px solid rgba(228, 228, 239, 0.06); border-radius: 3px; transition: all 0.3s; }
  .dcMapCellOn.dcMint {
    background: rgba(77, 232, 160, 0.6);     /* fill */
    border-color: #4de8a0;                   /* full-hex border */
    box-shadow:
      0 0 20px rgba(77, 232, 160, 0.15),     /* outer glow */
      inset 0 0 12px rgba(77, 232, 160, 0.08); /* inner glow */
  }
  /* coral variant: rgba(232,122,77,…) + #e87a4d ; amber variant: rgba(232,196,77,…) + #e8c44d */
  ```

- **Status / legend dots** carry a coloured glow:
  ```css
  .dotMint  { background: var(--mint);  box-shadow: 0 0 8px rgba(77, 232, 160, 0.55); }
  .dotCoral { background: var(--coral); box-shadow: 0 0 8px rgba(232, 122, 77, 0.55); }
  .dotAmber { background: var(--amber); box-shadow: 0 0 8px rgba(232, 196, 77, 0.55); }
  ```

- **Avatars / icon tiles** combine an inset hairline ring, a coloured outer ring,
  and a soft coloured glow, e.g. the map identity avatar:
  ```css
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    0 0 0 2px var(--coral),
    0 0 18px rgba(255, 122, 107, 0.28);
  ```

- **Reveal-on-scroll** base (globals.css): `.reveal { opacity: 0; transform: translateY(14px); transition: opacity .7s ease, transform .7s ease; } .reveal.in { opacity: 1; transform: none; }`

- **Type colour rule:** primary text is warm off-white `#f4ece4`, **never pure
  white**.

---

## Quick-start: minimum to reproduce the look

1. Set `<body>` background to the §2a substrate (warm navy `#161620` + two radial
   glows) and add the §2d grain overlay.
2. Add the §2b drafting grid as a fixed full-viewport layer (z-index 0).
3. Wrap content in a `z-index: 1; isolation: isolate` container with the §2c
   corner glows.
4. Load Space Grotesk (display) + Inter (body) + JetBrains Mono (mono) per §4.
5. Use the Direction C palette (§1b): bg `#161620`, surface `#1d1d29`, mint
   `#4de8a0`, coral `#e87a4d`, amber `#e8c44d`, gold `#f0e1b6`, text `#f4ece4` /
   `#c7b9ac` / `#8a7d72`.
6. Cards: `background: var(--surface); border-radius: 16–22px; box-shadow: var(--raise)` (§5a),
   `var(--emph)` for hero/feature cards, `var(--inset)` for recessed wells.
7. Primary buttons: §3a gradient + §5c shadow; everything depth-wise is shadows,
   no blur.
