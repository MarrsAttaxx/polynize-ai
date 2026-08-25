/**
 * Deterministic text overlay. AI image models cannot reliably render an exact
 * font, exact hex colour, exact justification, or selectively highlight words, so
 * brand-standard text is composited onto the image IN CODE via next/og (Satori):
 * pixel-perfect and identical every run. Only the words, their position, and the
 * highlighted words change; the font (Space Grotesk) and colours are fixed defaults.
 *
 * Flow: source image URL -> data URI + dimensions -> render text layer over it ->
 * PNG bytes -> stored in PAM's own bucket and served from /console/generated -> URL.
 * (It used to go to the Higgsfield CDN; see lib/marketing/image-host.ts for why it moved.)
 * Server-side only. Highlight words by wrapping them in *asterisks*.
 */

import { ImageResponse } from 'next/og';
import imageSizeFrom from 'image-size';
import { hostGeneratedImage } from './image-host';

export type OverlayPosition = 'top' | 'upper' | 'centre' | 'lower' | 'bottom';
export type OverlayHAlign = 'left' | 'centre' | 'right';
export type OverlaySize = 'small' | 'medium' | 'large';
export type OverlayOpts = {
  text: string;
  position: OverlayPosition;
  hAlign: OverlayHAlign;
  size: OverlaySize;
  baseColor: string;
  highlightColor: string;
  /**
   * FORCE THE OUTPUT SIZE, cropping the source to fill it (object-fit cover).
   *
   * Without this the render preserves the source's aspect ratio and caps the long edge at
   * 1080, so a 1536 x 2048 generation comes out 810 x 1080: under LinkedIn's 1080 wide and
   * the wrong ratio for a 4:5 feed card. A carousel needs the stronger guarantee anyway,
   * because Instagram crops every slide to the FIRST slide's dimensions, so all ten have to
   * be identical by construction rather than by luck. Omitted, the old behaviour is unchanged.
   */
  frame?: { w: number; h: number };
};

const SIZE_FRAC: Record<OverlaySize, number> = { small: 0.065, medium: 0.09, large: 0.115 };
const hAlignFlex = (h: OverlayHAlign): 'flex-start' | 'center' | 'flex-end' =>
  h === 'left' ? 'flex-start' : h === 'right' ? 'flex-end' : 'center';

export type OverlayResult = { url?: string; error?: string };

const FONT_URL =
  'https://cdn.jsdelivr.net/fontsource/fonts/space-grotesk@latest/latin-700-normal.ttf';

// Cache the font across warm invocations so we fetch it once.
let fontCache: ArrayBuffer | null = null;
async function spaceGrotesk(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;
  const res = await fetch(FONT_URL);
  if (!res.ok) throw new Error(`font fetch failed: ${res.status}`);
  fontCache = await res.arrayBuffer();
  return fontCache;
}

type Seg = { text: string; highlight: boolean };

/** Split a line into plain/highlight segments (highlight = wrapped in *asterisks*). */
function parseLine(line: string): Seg[] {
  const segs: Seg[] = [];
  const rx = /\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(line)) !== null) {
    if (m.index > last) segs.push({ text: line.slice(last, m.index), highlight: false });
    segs.push({ text: m[1], highlight: true });
    last = rx.lastIndex;
  }
  if (last < line.length) segs.push({ text: line.slice(last), highlight: false });
  return segs.length ? segs : [{ text: line, highlight: false }];
}

type VLayout = { justify: 'flex-start' | 'center' | 'flex-end'; padTopFrac: number; padBottomFrac: number };
/**
 * Vertical placement of the text block. Five anchors: hard top/bottom, the upper
 * and lower thirds, and centre. Achieved with justifyContent plus a top/bottom
 * padding fraction of the canvas height (Satori has no reliable transform).
 */
function layoutFor(p: OverlayPosition): VLayout {
  switch (p) {
    case 'top':
      return { justify: 'flex-start', padTopFrac: 0.06, padBottomFrac: 0.06 };
    case 'upper':
      return { justify: 'flex-start', padTopFrac: 0.22, padBottomFrac: 0.06 };
    case 'lower':
      return { justify: 'flex-end', padTopFrac: 0.06, padBottomFrac: 0.22 };
    case 'bottom':
      return { justify: 'flex-end', padTopFrac: 0.06, padBottomFrac: 0.06 };
    case 'centre':
    default:
      return { justify: 'center', padTopFrac: 0.06, padBottomFrac: 0.06 };
  }
}

export async function renderAndHostOverlay(
  imageUrl: string,
  opts: OverlayOpts,
  host: { stream: string; requestOrigin?: string }
): Promise<OverlayResult> {
  // 1. Fetch the source image -> data URI (so Satori embeds it, no refetch) + dims.
  let dataUri: string;
  let width: number;
  let height: number;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return { error: `could not fetch the source image (${res.status})` };
    const buf = Buffer.from(await res.arrayBuffer());
    const dim = imageSizeFrom(buf);
    if (!dim.width || !dim.height) return { error: 'could not read the image dimensions' };
    if (opts.frame) {
      // An exact frame was asked for: the source fills it and is cropped, never letterboxed.
      width = opts.frame.w;
      height = opts.frame.h;
    } else {
      // Cap the long edge so the render stays fast + the PNG stays a sane size.
      const scale = Math.min(1, 1080 / Math.max(dim.width, dim.height));
      width = Math.round(dim.width * scale);
      height = Math.round(dim.height * scale);
    }
    const mime = dim.type === 'jpg' ? 'image/jpeg' : `image/${dim.type ?? 'png'}`;
    dataUri = `data:${mime};base64,${buf.toString('base64')}`;
  } catch (e) {
    console.error('[overlay] source fetch failed:', e);
    return { error: 'Network error reading the source image.' };
  }

  const lines = opts.text.split('\n').map(parseLine);
  const fontSize = Math.round(width * (SIZE_FRAC[opts.size] ?? SIZE_FRAC.medium));
  const gap = Math.round(fontSize * 0.28);
  const L = layoutFor(opts.position);
  const hAlign = hAlignFlex(opts.hAlign);
  const hpad = Math.round(width * 0.06);

  let png: ArrayBuffer;
  try {
    const font = await spaceGrotesk();
    const el = (
      <div style={{ display: 'flex', position: 'relative', width, height }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUri}
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0, width, height, objectFit: 'cover' }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width,
            height,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: L.justify,
            alignItems: hAlign,
            paddingLeft: hpad,
            paddingRight: hpad,
            paddingTop: Math.round(height * L.padTopFrac),
            paddingBottom: Math.round(height * L.padBottomFrac),
          }}
        >
          {lines.map((segs, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: hAlign,
                width: '100%',
                fontFamily: 'Space Grotesk',
                fontWeight: 700,
                fontSize,
                lineHeight: 1.05,
                textShadow: '0 2px 14px rgba(0,0,0,0.55)',
              }}
            >
              {segs.flatMap((seg, si) =>
                seg.text
                  .split(/\s+/)
                  .filter((w) => w.length)
                  .map((word, wi) => (
                    <span
                      key={`${si}-${wi}`}
                      style={{
                        color: seg.highlight ? opts.highlightColor : opts.baseColor,
                        marginRight: gap,
                      }}
                    >
                      {word}
                    </span>
                  ))
              )}
            </div>
          ))}
        </div>
      </div>
    );

    const response = new ImageResponse(el, {
      width,
      height,
      fonts: [{ name: 'Space Grotesk', data: font, weight: 700, style: 'normal' }],
    });
    png = await response.arrayBuffer();
  } catch (e) {
    console.error('[overlay] render failed:', e);
    return { error: 'Could not render the text overlay. Try again.' };
  }

  // Rendered fine; only storing it can fail from here.
  return hostGeneratedImage(Buffer.from(png), 'image/png', host);
}
