/**
 * WHERE TEXT IS ALLOWED TO GO on a vertical video frame.
 *
 * Every number in this file came off a platform's own published artwork, not a blog. The
 * reasoning, the sources, and the two claims I got wrong on the way are in
 * docs/pam-console/output-spec.md section 8b and 8c. This module exists so the caption
 * renderer, the carousel PDF, the text-on-image cards and the image playground all read one
 * set of numbers instead of each re-deriving them and drifting.
 *
 * THE REFERENCE FRAME IS 1080 x 1920. Everything is stored as insets on that frame and
 * scaled proportionally for any other canvas, because every platform states its guidance as
 * a share of the frame rather than in absolute pixels.
 *
 * THE ONE NUMBER TO REMEMBER: 660 x 960 at offset 120, 288. Outside that, at least one of
 * the three platforms can cover what you drew.
 */

export const REFERENCE_W = 1080;
export const REFERENCE_H = 1920;

/** Pixels reserved on each edge of a 1080 x 1920 frame. */
export type Insets = { top: number; bottom: number; left: number; right: number };

/** A drawable box, in pixels, on whatever canvas was asked for. */
export type SafeRect = { x: number; y: number; w: number; h: number };

/**
 * The three platforms' own figures, on a 1080 x 1920 frame.
 *
 * meta: stated as percentages (14% top, 35% bottom, 6% sides) and converted here.
 * google: extracted from the SVG diagram in Google Ads Help answer/9128498, corroborated
 *   independently with identical values.
 * tiktok: MEASURED from TikTok's own In-Feed-Standard LTR safe-zone template
 *   (`In-Feed/Feed.png`, authored in 720 x 1280 coordinates, scaled x1.5 here). The labels
 *   drawn on the artwork and a pixel scan of its alpha channel agree exactly.
 *
 * All three are AD guidance, which is more conservative than the organic player because it
 * leaves room for a CTA button. That is deliberate: the cost of being too careful is a
 * caption sitting 100px higher than it had to, and the cost of being wrong is a caption
 * nobody can read.
 */
export const PLATFORM_INSETS: Record<'meta' | 'google' | 'tiktok', Insets> = {
  meta: { top: 269, bottom: 672, left: 65, right: 65 },
  google: { top: 288, bottom: 672, left: 48, right: 192 },
  // 160 / 440 / 80, and 80 + the 120-wide action rail = 200, all x1.5.
  tiktok: { top: 240, bottom: 660, left: 120, right: 300 },
};

/**
 * TikTok's right edge is NOT one number, which is the part no third-party guide gets right.
 * Its like/comment/share/sound column occupies the bottom 720 of a 1280-tall frame, so above
 * that line the right inset is only 120px. `PLATFORM_INSETS.tiktok.right` carries the
 * conservative 300; this is the honest two-region shape for anyone who needs the extra width
 * in the top half of the frame.
 */
export const TIKTOK_RAIL = {
  /** y on a 1080 x 1920 frame where the action rail begins (560 x 1.5). */
  startsAtY: 840,
  /** Right inset above that line. */
  rightAbove: 120,
  /** Right inset from that line down. */
  rightBelow: 300,
} as const;

/** Worst case on every edge, which is what the renderer targets. */
export const ENVELOPE: Insets = {
  top: Math.max(PLATFORM_INSETS.meta.top, PLATFORM_INSETS.google.top, PLATFORM_INSETS.tiktok.top),
  bottom: Math.max(
    PLATFORM_INSETS.meta.bottom,
    PLATFORM_INSETS.google.bottom,
    PLATFORM_INSETS.tiktok.bottom
  ),
  left: Math.max(
    PLATFORM_INSETS.meta.left,
    PLATFORM_INSETS.google.left,
    PLATFORM_INSETS.tiktok.left
  ),
  right: Math.max(
    PLATFORM_INSETS.meta.right,
    PLATFORM_INSETS.google.right,
    PLATFORM_INSETS.tiktok.right
  ),
};

/**
 * The safe box on a canvas of any size.
 *
 * Insets scale by each axis independently, so this is still correct for a 9:16 canvas at a
 * different resolution (1080x1920, 720x1280, 2160x3840). Hand it a canvas that is NOT 9:16
 * and it will still return a proportional box, but the answer is only meaningful if the
 * platform letterboxes rather than crops, so check before trusting it.
 */
export function safeRect(
  w: number = REFERENCE_W,
  h: number = REFERENCE_H,
  insets: Insets = ENVELOPE
): SafeRect {
  const sx = w / REFERENCE_W;
  const sy = h / REFERENCE_H;
  const x = Math.round(insets.left * sx);
  const y = Math.round(insets.top * sy);
  return {
    x,
    y,
    w: Math.round(w - (insets.left + insets.right) * sx),
    h: Math.round(h - (insets.top + insets.bottom) * sy),
  };
}

/** The safe box for one platform, when a piece is being built for that platform alone. */
export function safeRectFor(
  platform: keyof typeof PLATFORM_INSETS,
  w: number = REFERENCE_W,
  h: number = REFERENCE_H
): SafeRect {
  return safeRect(w, h, PLATFORM_INSETS[platform]);
}

/**
 * True if a box drawn at these coordinates survives on all three platforms.
 * Coordinates are on the canvas given, not the reference frame.
 */
export function withinSafeArea(
  box: SafeRect,
  w: number = REFERENCE_W,
  h: number = REFERENCE_H
): boolean {
  const s = safeRect(w, h);
  return (
    box.x >= s.x && box.y >= s.y && box.x + box.w <= s.x + s.w && box.y + box.h <= s.y + s.h
  );
}

/**
 * One line an operator can read, for the overlay guide and the spec panel.
 * Deliberately says which platform binds each edge, because "why is it so narrow" is the
 * first question anyone asks when they see the box.
 */
export function envelopeSummary(): string {
  const s = safeRect();
  return `${s.w} x ${s.h} at ${s.x}, ${s.y} on a ${REFERENCE_W} x ${REFERENCE_H} frame. Top and bottom set by YouTube and Meta, both sides set by TikTok.`;
}
