# Post-Modular Roadmap

This document collects all work that happens **after** the modular architecture lands, so we keep the in-flight plan focused on Phase 3 delivery. Everything here remains postponed until the new interfaces and controller are stable.

## Phase 4: Alternative Implementations *(postponed)*

Goal: Prove the plugin architecture by swapping in alternative detectors, samplers, and sonifiers.

### 4.1 Mouse Point Detector
- Implement `src/detection/mouse/MousePointDetector.ts` using the `PointDetector` interface; emit a single `DetectedPoint` from `mousemove` events.
- Add Vitest coverage simulating mouse events.

### 4.2 MIDI Sonifier
- Implement `src/sonification/MIDISonifier.ts` with the `Sonifier` interface; map hue→MIDI note, value→velocity via Web MIDI API.
- Mock Web MIDI in tests to verify note-on/off behavior.

### 4.3 Three-Channel Sonifier
- Implement `src/sonification/StereoOscillatorSonifier.ts`; hue→frequency, saturation→pan, value→volume using `StereoPannerNode`.
- Keep usage to a one-line swap in `ApplicationController` wiring.

### 4.4 Brightness Sampler
- Implement `src/sampling/BrightnessImageSampler.ts`; return `{ data: { brightness, contrast } }`.
- Verify luminance math in Vitest.

## Phase 5: Configuration & Presets *(postponed)*

Goal: Enable plug-and-play composition without code edits.

### 5.1 JSON Configuration Format
- Define `HerakoiConfig` schema in `src/core/config.schema.ts` covering detector/sampler/sonifier variants.

### 5.2 Presets
- Add JSON presets under `src/presets/` (one-channel hands, three-channel hands, mouse-brightness).

### 5.3 Plugin Registry & Loader
- Build `src/core/PluginRegistry.ts` to instantiate plugins from config and hand back an `ApplicationController`.
- Allow runtime preset switching without reload.

## Phase 6: Developer Experience & Documentation *(postponed)*

Goal: Make extension and onboarding easy once modular pieces are stable.

### 6.1 Plugin Development Guide
- Create `docs/plugin-development.md` covering interface contracts, testing strategies, and registration.

### 6.2 Architecture Diagram
- Add `docs/architecture.md` with flow and sequence diagrams.

### 6.3 API Documentation
- Add JSDoc across interfaces describing coordinate conventions, expected data keys, and examples.

## Success Metrics (Post-Modular)
- Alternative plugins swap with no controller changes.
- Presets load correctly via registry; runtime switching works.
- Documentation published and referenced from the main README/roadmap.
