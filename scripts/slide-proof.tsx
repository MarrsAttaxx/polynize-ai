/**
 * PROOF THAT THE THREE TEMPLATES ACTUALLY DRAW.
 *
 * `npx tsx scripts/slide-proof.tsx [outDir]`
 *
 * Satori supports a subset of CSS and fails SILENTLY on the rest: an unsupported property does
 * not throw, it just stops drawing, so a template can typecheck, pass review and come out of
 * the oven with no accent seam and no footer. The only way to know is to render it. This writes
 * one PNG per template at exactly 1080 x 1350 and prints the byte size of each.
 *
 * No network beyond the two font files, no bucket, no piece: it calls `slideElement` directly.
 * The split proof uses a local gradient PNG rather than a generation, because what is being
 * proved is the composition and not the model.
 */

import { writeFileSync } from 'node:fs';
import { ImageResponse } from 'next/og';
import { slideElement, slideFonts, type Frame } from '../lib/marketing/slide-render';
import { SLIDE_W, SLIDE_H, TEMPLATES } from '../lib/marketing/slide-plan';

/**
 * A 2x2 png of four brand colours, stretched by objectFit cover. Enough to prove the window
 * clips, the radius holds and the seam sits on the photograph's bottom edge.
 */
const STUB_IMAGE =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAF0lEQVR4nGPI/HP6f1U2w4cd2V/ePAEAPAAI7Mty+tUAAAAASUVORK5CYII=';

const FRAME: Frame = {
  headline: 'Everyone is *bolting AI on* to a process that was already broken',
  sub: 'Strip the process back first. Then decide what an agent is actually for.',
  kicker: 'Emergent AI',
  accent: '#69fccb',
  n: 3,
  total: 10,
  role: 'body',
  position: 'lower',
  bgDataUri: STUB_IMAGE,
};

async function main() {
  const out = process.argv[2] ?? '.';
  const { bold, medium } = await slideFonts();
  for (const t of TEMPLATES) {
    const res = new ImageResponse(slideElement(t, FRAME), {
      width: SLIDE_W,
      height: SLIDE_H,
      fonts: [
        { name: 'Space Grotesk', data: bold, weight: 700, style: 'normal' },
        { name: 'Space Grotesk', data: medium, weight: 500, style: 'normal' },
      ],
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const file = `${out}/slide-${t}.png`;
    writeFileSync(file, buf);
    console.log(`${t}: ${buf.length} bytes -> ${file}`);
  }
}

void main();
