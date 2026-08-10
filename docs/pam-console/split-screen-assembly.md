# Split-screen assembly (9:16 hero) — proven recipe

> **SUPERSEDED IN PART, 2026-08-10.** Marrs found the overhead angle was being **morphed**: it was
> shot in PORTRAIT and the recipe's bottom-half crop did not match it, so the display came out
> distorted and at lower resolution than it should have been. He is re-rigging the bird's-eye camera
> **LANDSCAPE** to get the display at proper resolution. **The geometry in "Composite geometry"
> below is therefore correct only for a portrait overhead and must not be reused as-is.** Read
> [Landscape overhead](#landscape-overhead-2026-08-10) first. Also settled: **1080p is fine**, 4K is
> not required. The sync method, the audio source and the framing intent are all unaffected.

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

## Landscape overhead (2026-08-10)

The overhead camera is being turned landscape. This changes the maths, and it introduces one real
decision that footage has to settle, so it is written down before the next shoot rather than after.

**Why the old crop morphed it.** The recipe assumed a 2160x3840 portrait overhead and took
`crop=2160:1920:0:1920`, which is 9:8, scaling cleanly into the 1080x960 slot. Against a landscape
frame that crop is not just wrongly placed, it is taller than the source, so the result is stretched
rather than cropped. It was a geometry mismatch, not a quality setting.

**The constraint that matters for framing the shot.** In a 50/50 split of 1080x1920, each slot is
**1080x960, which is 9:8, very nearly square.** A landscape frame is 16:9. **A 16:9 image cannot fill
a 9:8 slot without either cropping about a third off the sides or letterboxing.** So:

> **Frame the landscape overhead so the display fills the CENTRE, and treat the left and right
> thirds as expendable.** Anything at the far sides of that frame will not survive the crop.

At 1080p the numbers are: overhead 1920x1080, crop the centre `1215x1080` (9:8), scale to 1080x960.
Front stays portrait 1080x1920, take `1080x960` off the top, no scaling at all.

```bash
# Landscape overhead, 1080p sources. Front audio, per the audio-source note below.
ffmpeg \
 -ss <t> -i Front.mov \
 -ss <t+offset> -i Top.mov \
 -filter_complex "\
[0:v]crop=1080:960:0:60,setsar=1[top];\
[1:v]crop=1215:1080:352:0,scale=1080:960,setsar=1[bot];\
[top][bot]vstack=inputs=2[v]" \
 -map "[v]" -map 0:a -r 25 \
 -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k \
 out.mp4
```

**The open decision, for the footage to answer.** If cropping a third off the sides loses part of the
display, 50/50 is the wrong split for a landscape overhead and the alternative is to give the
overhead a 16:9 slot of its own: 1080x608, leaving 1080x1312 for the front. That is roughly a 68/32
split, and it keeps the whole landscape frame with no crop at all. It is a different composition from
the one Marrs has been framing for, so it is his call and not a derivation. **Do not pick one from the
maths; render both from the demo footage and look.**

What carries over unchanged: audio cross-correlation for sync (the cameras are not jam-synced), audio
from the front camera via the DJI lapels, hard cuts only, and the framing intent that screen content
sits just below centre with the desk filling the strip that platform UI covers.

## Still to build

**This render cannot run on Vercel, and that is a design fact rather than a limitation to work
around.** The footage is multi-gigabyte and lives on Marrs's Mac; a serverless function has neither
the disk, the time, nor the file. So the split is:

- **The console owns the PLAN and the STATE**: which shoot, which two angles, which takes are keepers,
  the measured sync offset, the chosen composition, and the piece the result becomes.
- **A local script owns the RENDER**: read the shoot folder, identify the angles, cross-correlate the
  audio, cut to the keeper takes, run the composite, write the result back.

Cutting to clean takes stays with Descript, which solved that problem once already and should not be
re-solved in ffmpeg.

Blocked on real footage from the re-rigged landscape overhead, which is the right order: the open
split decision above cannot be settled from arithmetic.


## Audio source (settled 2026-07-28, Marrs)

DJI lapel mics run into the **FRONT camera**, so the front camera's audio is both the
published audio and the sync reference. No third stream to align and no master-audio
decision: this is exactly the configuration the test footage above was shot in, so the
measured 383ms cross-correlation offset and the recipe stand as-is.
