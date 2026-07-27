# Split-screen assembly (9:16 hero) — proven recipe

The assembly half of D29's hero format: two camera angles in, one 1080x1920
split-screen out. Everything here was measured against real test footage
(`~/Movies/polynize-studio/test-01/`, 2026-07-21) and rendered end to end, so it
is a working recipe rather than a plan.

## The rig, as measured

| | Front angle | Overhead angle |
|---|---|---|
| Device | iPhone 17 Pro | iPhone 13 Pro |
| Stored | 3840x2160 HEVC, `rotation=-90` | 3840x2160 HEVC, `rotation=-90` |
| Displays as | **2160x3840 (9:16 vertical)** | **2160x3840 (9:16 vertical)** |
| Frame rate | 25 fps | 25 fps |
| Audio | PCM s16le, 48kHz, stereo | PCM s16le, 48kHz, stereo |

Both phones write their own timecode track but they are **not jam-synced**
(`00:00:00:14` vs `00:00:00:03`), so timecode cannot be used to align them.
**Audio is the sync source**, which works because both cameras record the same room
sound as uncompressed PCM.

Shooting 9:16 (rather than 16:9 and cropping) is the right call and the maths
confirms it: each angle fills half of a 1080x1920 frame, i.e. 1080x960, and a
**2160x1920 crop of a 2160x3840 source is exactly 9:8**, so it scales into that slot
with a clean 2x downsample and no distortion.

## Sync

Cross-correlate the two audio tracks (rectified envelope at 1kHz is enough, +/-3s
search) and trim the earlier file by the offset. On the test footage the Top camera
led the Front by **383 ms**, independently corroborated by the 400 ms difference in
clip duration. No slate or clap is needed.

## Composite geometry (the locked framing)

The split is **50/50**, and the overhead crop is deliberately **not** centred on the
display. The display's TOP EDGE sits on the cut line, so:

- the screen content lands just below the centre of the frame, which is where a
  phone viewer actually looks, and
- the desk, the presenter's hands and the monitoring iPad fill the bottom of the
  frame, which is the strip that social platform captions and UI chrome cover.

Marrs frames the shoot this way on purpose. Do not "improve" it by centring the
display in its half: that pushes the content down into the UI overlay.

```bash
ffmpeg \
 -ss <t> -i Front_Test.mov \
 -ss <t+0.383> -i Top_Test.mov \
 -filter_complex "\
[0:v]crop=2160:1920:0:120,scale=1080:960,setsar=1[top];\
[1:v]crop=2160:1920:0:1920,scale=1080:960,setsar=1[bot];\
[top][bot]vstack=inputs=2[v]" \
 -map "[v]" -map 0:a -r 25 \
 -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k \
 out.mp4
```

- `crop=2160:1920:0:120` on the front angle: the top of its frame, giving a mid shot
  from a little above the head to mid torso.
- `crop=2160:1920:0:1920` on the overhead: exactly the bottom half of its frame,
  which puts the display's top edge (source y~1960) on the cut line.
- Audio is taken from the front camera.

Renders a 15s test in about 3 seconds on the M-series Mac, so full pieces are cheap.

## What this means for the SCREEN PROMPT

Two rules are baked into `split_screen_short.screenPromptShape` from this footage:

1. **The whole display is in shot**, so there is no crop safe area. Compose edge to
   edge. (An earlier derivation wrongly imposed a centred 9:8 safe area; the footage
   disproved it.)
2. **The hand enters from the RIGHT** and rests over the right and lower-right of the
   display. Keep the payoff left of centre and high; put the touch target on the
   right where the hand already is.

## Production notes for the next shoot

- Move the overhead camera **closer**: the display currently fills only about a
  quarter of that frame's height, so the crop carries more desk, brick and stray
  props than it needs to.
- **Lock exposure on the screen.** The phone exposes for the room, so the display
  reads washed-out grey instead of the deep ink black of the design system.
- Tidy the desk immediately around the display; anything within about a screen-height
  below it is in frame.
- The monitoring iPad is visible under the display. Keep it if the meta look is
  wanted, move it if not.

## Still to build

The console step that runs this: watch `~/Movies/polynize-studio/<shoot>/`, identify
the two angles, cross-correlate, cut to clean takes in Descript, then run the
composite above. The recipe is proven; only the wiring remains.
