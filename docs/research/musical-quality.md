# Research: Musical Quality of the Piano Sampler

Living notes on how the piano sampler sounds and what we tried to make it more musical.
Add a log entry for each experiment: what changed, which values, which images, how it sounded.
When a direction is settled (e.g. presets), record the decision as an ADR in `docs/adrs/` and link it here.

## Current Mapping

- **Pitch** — hue (0–300°, values above 300° clip to 0) is mapped onto the notes of the selected
  scale within the MIDI range. Each note gets an equal share of hue.
- **Velocity** — value/brightness (0–255) maps linearly into the velocity range.
- **Articulation** — one-shot notes (default duration `8n`); a point only triggers when its note changes.
- **Gating** — hysteresis and a minimum interval per point decide when a note change counts
  (see `noteGate.ts`).

## Settings

All live in `src/plugins/sonification/piano-sampler/config.ts` and are exposed in the settings panel.

| Setting | Range | Default | Effect |
|---------|-------|---------|--------|
| `noteMin` / `noteMax` | MIDI 21–108 | 36–83 (C2–B5) | Pitch range |
| `scale` | chromatic, major, pentatonic (root C) | pentatonic | Which notes can sound |
| `hysteresis` | 0–0.45 of a note band | 0.25 | How far past a note boundary the color must move before the note changes |
| `minIntervalMs` | 0–500 ms | 100 | Minimum time between two notes of the same point |
| `velocityMin` / `velocityMax` | 0–127 | 40–127 | Dynamics range |
| `noteDuration` | `32n` … `1n` | `8n` | Note length |

## The Original Problem: Sensitivity and Trigger Rate

When moving a finger slightly, the piano sampler fired many notes in rapid succession because:

1. **No frame throttling** — every camera frame (~30–60 fps) drives the full pipeline
   (`src/hooks/engine/useTransportLoop.ts:112`).
2. **No color smoothing** — HSV pixel values are read raw each frame
   (`src/plugins/sampling/hsv/HSVImageSampler.ts`); a 1-pixel shift can change the hue enough to
   cross a note boundary.
3. **Strict note deduplication** — only an exactly repeated note was skipped, so a ±1 fluctuation
   fired a new attack.
4. **Narrow note bands** — chromatic over C2–B5 means 48 notes in 300° of hue, about 6° per note.

### Approaches Considered

- **A — Gating in the piano sonifier** (piano-only). Originally proposed as a dead-zone of ±N
  semitones; implemented instead as hysteresis plus a minimum interval (see the log), because a
  dead-zone also blocks deliberate moves to neighboring notes.
- **B — Throttle in `useTransportLoop`** (all plugins). Fewer `processSamples` calls; cross-cutting,
  may affect responsiveness of other plugins.
- **C — Color smoothing in `HSVImageSampler`** (all plugins). Average hue/value over the last N
  frames; stabilizes input at the source but adds latency and per-point history.
- **D — Combination** of A with B or C.

Status: A is implemented. B and C remain open, to revisit if A is not enough.

## Experiment Log

### 2026-10-01 — Scale quantization

- Added the `scale` setting: chromatic, C major, C major pentatonic.
- Hue is split evenly across the scale's notes rather than snapping chromatic notes to the scale,
  so every note gets the same share of hue. Chromatic reproduces the previous mapping exactly.
- Default range in pentatonic: 20 notes instead of 48, about 15° of hue per note. Besides sounding
  more consonant, this widens the note bands and lowers sensitivity.
- Verdict: liked, committed (`788b4e5`).

### 2026-10-02 — Hysteresis and minimum interval

- **Hysteresis**: the color must cross a note boundary by a fraction of a band before the note
  changes, in both directions. Filters noise around boundaries while keeping every neighboring note
  playable and letting big jumps through immediately.
- **Minimum interval**: caps how many notes per second a single point can fire; a pending change
  plays as soon as the interval has passed, if the point is still there.
- Defaults (25%, 100 ms) were picked as a starting point.
- Verdict: _to be evaluated by ear with the camera._

## Open Ideas

- **Presets instead of free parameters** — e.g. "Calm" (pentatonic, high hysteresis, ~200 ms),
  "Expressive" (major, medium hysteresis, ~100 ms), "Raw" (chromatic, everything at 0), with the
  sliders kept in an "Advanced" section for research. Record the choice as an ADR.
- **Hold mode** — sustain a note while the point stays on its color, release when it changes or
  the point disappears. Less natural for a sampled piano, whose notes decay on their own; could be
  a separate "Note mode: one-shot / hold" setting.
- **Other roots and scales** — root note selection, minor and minor pentatonic.
- **Upstream smoothing or throttling** — options B and C above.
