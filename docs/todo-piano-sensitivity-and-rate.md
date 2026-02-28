# TODO: Piano Sensitivity and Note Trigger Rate

## Problem

When moving a finger slightly, the piano sampler fires many notes in rapid succession.
Even small movements cause continuous re-triggering because:

1. **No frame throttling** — every camera frame (~30–60 fps) drives the full pipeline
2. **No color smoothing** — HSV pixel values are read raw each frame; a 1-pixel position shift can change the sampled hue byte and map to a different MIDI note
3. **Strict note deduplication** — `PianoSamplerSonifier.processSamples()` only skips re-triggering if the exact same MIDI note repeats; a ±1 fluctuation fires a new attack

## Relevant Files

| File | Location | Role |
|------|----------|------|
| `PianoSamplerSonifier.ts` | `src/plugins/sonification/piano-sampler/` | Contains `processSamples()` — where notes are fired and deduplicated |
| `useTransportLoop.ts` | `src/hooks/engine/` | Drives `processSamples` on every detector frame (no throttle) |
| `HSVImageSampler.ts` | `src/plugins/sampling/hsv/` | Reads raw pixel HSV — no smoothing or averaging |
| `config.ts` | `src/plugins/sonification/piano-sampler/` | Defines `PianoSamplerConfig` — where new config knobs would live |
| `SettingsPanel.tsx` | `src/plugins/sonification/piano-sampler/components/` | UI for exposing new config knobs to the user |

## Key Code Locations

**Note deduplication** — `PianoSamplerSonifier.ts:154`
```ts
if (midiNote === this.lastNotes.get(id)) {
  seen.add(id);
  continue;
}
```
Currently only skips if the note is *exactly* the same integer.

**Frame loop** — `useTransportLoop.ts:112`
```ts
for await (const points of activeDetector.detector.points(abortController.signal))
```
No rate limiting; every detected frame calls the full pipeline.

## Possible Approaches

### Option A — Dead-zone in `processSamples` (smallest scope, piano-only)
Add a configurable `noteChangeSensitivity` threshold so notes within ±N semitones of
the last note are treated as the same note:

```ts
const lastNote = this.lastNotes.get(id) ?? -999;
if (Math.abs(midiNote - lastNote) <= this.noteChangeSensitivity) {
  seen.add(id);
  continue;
}
```

Pros: isolated to the piano-sampler plugin, easy to expose as a UI slider.
Cons: doesn't reduce CPU/audio work — still computing notes every frame.

### Option B — Throttle in `useTransportLoop` (affects all plugins)
Limit how often `processSamples` is called, e.g. every N ms, by skipping frames.
Pros: reduces work for all sonifiers; may help oscillator too.
Cons: cross-cutting change; could affect detection responsiveness for other plugins.

### Option C — Color smoothing in `HSVImageSampler` (affects all plugins)
Average the sampled hue/value over the last N frames before returning data.
Pros: stabilises input at the source; benefits all downstream plugins.
Cons: introduces latency; needs to track per-point history; bigger change.

### Option D — Combination
A + B or A + C: dead-zone in the sonifier for immediate note stability, plus
upstream smoothing or throttling for CPU/responsiveness improvement.

## Recommendation (to decide)

Start with **Option A** (dead-zone) as it is:
- Fully isolated to the piano-sampler plugin
- Adds a user-facing `noteChangeSensitivity` config knob (0–5 semitones)
- Zero risk to other plugins
- Can be shipped independently, with B or C explored as a follow-up

Then evaluate whether **Option B** or **C** is worth the cross-cutting impact.
