/**
 * A QR code as an inline SVG, for the studio shoot queue.
 *
 * WHY IT EXISTS. The studio walkthrough has one step the console cannot do: the teleprompter has to open
 * on the IPAD, and nothing can push a url to another device. Without this Marrs is typing a uuid-bearing
 * url into an iPad with two cameras waiting. He points the iPad at the screen instead.
 *
 * WHY IT USES A LIBRARY, having first been hand-rolled. I wrote an encoder, and it passed every structural
 * test I could think of: three correct finder patterns, a legal version size, an alternating timing
 * pattern, a plausible dark-module ratio. Then I rasterised it and asked jsQR, which shares none of my
 * code, to read it back, and IT COULD NOT. The structure was right and the code was still unscannable,
 * which is the worst kind of wrong: a square of dots that looks like a QR code and wastes a studio setup.
 *
 * The reasoning that led me to hand-roll it was also wrong. I argued a shoot must not depend on a fetched
 * dependency, but `qrcode` runs at BUILD and RENDER time on the server and the SVG is inlined into the
 * page, so there is nothing to fetch when the camera is rolling. The constraint I was protecting against
 * did not apply.
 */

import QRCode from 'qrcode';

/**
 * A QR code for `text` as an inline SVG string, in the brand's ink and cream.
 *
 * Error correction level M, which tolerates a phone held at an angle in studio lighting without inflating
 * the module count. Returns null rather than throwing, so a row with an unencodable url falls back to
 * showing the url instead of breaking the page: in a studio, a visible url beats a missing one.
 */
export async function qrSvg(
  text: string,
  opts?: { size?: number }
): Promise<string | null> {
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: opts?.size ?? 132,
      color: { dark: '#0a0a0f', light: '#f4ece4' },
    });
  } catch (err) {
    console.error('[qr] could not encode:', err);
    return null;
  }
}
