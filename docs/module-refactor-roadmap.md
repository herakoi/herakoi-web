# Herakoi Web Module Refactor Roadmap

## Vision: Plugin Architecture

Herakoi's core loop is simple: **detect point → extract image data → create sound**. The current implementation hardcodes MediaPipe hands, HSV sampling, and Web Audio oscillators. This roadmap establishes three pluggable abstractions that enable complete substitution via configuration:

1. **PointDetector** - Provides spatial coordinates from any input source
   - Current: Camera + MediaPipe Hands → fingertip coordinates
   - Future: Mouse position, touchscreen, eye tracking, MIDI controller XY, gesture recognition

2. **ImageSampler** - Extracts visual information at given coordinates
   - Current: RGB→HSV conversion, returns hue/saturation/value bytes
   - Future: Brightness patterns, texture analysis, edge detection, color harmony, multiple samples around point

3. **Sonifier** - Transforms extracted data into audio output
   - Current: Web Audio oscillators (hue→frequency, value→volume)
   - Future: MIDI note-on/note-off, polyphonic synthesis, granular synthesis, sample triggering, external hardware

**Core principle:** Swapping implementations should require only configuration changes, not code rewrites. The controller orchestrates these three interfaces without knowing their concrete implementations.

---

## Current Status

**Phase 1: Modern Tooling** - **COMPLETE**
- [x] TypeScript + Vite, pnpm, Biome, Vitest, Lefthook, PostCSS

**Phase 2: Initial Module Extraction** - **85% COMPLETE**
- [x] Vision modules (`HandsDetector`, `ImageSampler`, `handGeometry`)
- [x] Audio module (`Sonifier`)
- [x] Canvas utilities (`overlay`)
- [x] Test coverage (8 tests passing)
- [ ] Abstractions not yet interface-based (classes are concrete, not swappable)
- [ ] Orchestration still monolithic in `main.ts` (373 lines)
- [ ] No plugin composition system

---

## Phase 3: Interface-Driven Architecture (Immediate Priority)

### Goal
Define and implement the three core abstractions as TypeScript interfaces, refactor existing code to conform, and create a composition system that wires them together.

### 3.1 Define Core Interfaces

**Create `src/core/interfaces.ts`:**

```typescript
// Point detection abstraction
export interface PointDetector {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  onPointsDetected(callback: (points: DetectedPoint[]) => void): void;
}

export interface DetectedPoint {
  id: string;           // e.g., "hand-0-index-tip", "mouse", "touch-1"
  x: number;            // normalized 0-1 or canvas pixels (TBD)
  y: number;
}

// Image sampling abstraction
export interface ImageSampler {
  loadImage(source: HTMLImageElement | HTMLCanvasElement): void;
  sampleAt(point: DetectedPoint): ImageSample | null;
}

export interface ImageSample {
  data: Record<string, number>; // flexible key-value (hue, saturation, value, brightness, etc.)
}

// Sonification abstraction - directly consumes ImageSample data
export interface Sonifier {
  initialize(): Promise<void>;
  processSamples(samples: Map<string, ImageSample>): void; // id → sample data
  stop(): void;
  configure(options: Record<string, unknown>): void; // e.g., frequency range, oscillator type
}
```

**Design decisions to make:**
- Coordinate system: normalized 0-1 vs canvas pixels? (Propose: normalized for portability)
- Sample data structure: fixed keys vs flexible Record? (Propose: flexible for extensibility)
- Async initialization: all interfaces or just detectors? (Propose: all, for consistency)
- Data interpretation: Each Sonifier implementation decides how to interpret ImageSample data (hue→frequency, brightness→volume, etc.)

### 3.2 Refactor Existing Implementations to Interfaces

**Tasks:**
- Create `src/detection/mediapipe/MediaPipePointDetector.ts`
  - Wraps `HandsDetector` + `Camera` lifecycle
  - Implements `PointDetector` interface
  - Converts MediaPipe landmarks → `DetectedPoint[]` with finger focus logic
  - Tests: `MediaPipePointDetector.test.ts`

- Refactor `src/vision/imageEncoding.ts` → `src/sampling/HSVImageSampler.ts`
  - Current `ImageSampler` class becomes `HSVImageSampler`
  - Implements `ImageSampler` interface
  - Returns `{ data: { hue, saturation, value } }`
  - Tests: Update existing `imageEncoding.test.ts` → `HSVImageSampler.test.ts`

- Refactor `src/audio/sonification.ts` → `src/sonification/OscillatorSonifier.ts`
  - Current `Sonifier` class becomes `OscillatorSonifier`
  - Implements `Sonifier` interface
  - Internally maps ImageSample data (hue→frequency, value→volume) to oscillator nodes
  - Tests: Update `sonification.test.ts` → `OscillatorSonifier.test.ts`

**Migration strategy:**
- Keep old imports working temporarily via barrel exports
- Update `main.ts` to use new paths once refactor complete
- Remove old files in final cleanup commit

### 3.3 Create Plugin Composition System

**Create `src/core/ApplicationController.ts`:**

```typescript
export class ApplicationController {
  constructor(
    private detector: PointDetector,
    private sampler: ImageSampler,
    private sonifier: Sonifier,
  ) {}

  async start() {
    await this.detector.initialize();
    await this.sonifier.initialize();

    this.detector.onPointsDetected((points) => {
      const samples = new Map<string, ImageSample>();

      for (const point of points) {
        const sample = this.sampler.sampleAt(point);
        if (sample) {
          samples.set(point.id, sample);
        }
      }

      this.sonifier.processSamples(samples);
    });

    await this.detector.start();
  }

  async stop() {
    await this.detector.stop();
    this.sonifier.stop();
  }
}
```

**Update `src/oneChannel/main.ts` to use composition:**

```typescript
import { ApplicationController } from '#src/core/ApplicationController';
import { MediaPipePointDetector } from '#src/detection/mediapipe/MediaPipePointDetector';
import { HSVImageSampler } from '#src/sampling/HSVImageSampler';
import { OscillatorSonifier } from '#src/sonification/OscillatorSonifier';

// ... DOM acquisition, UI controls setup ...

const detector = new MediaPipePointDetector({
  video: cameraVideoElement,
  maxHands,
  // ... MediaPipe options
});

const sampler = new HSVImageSampler(sourceImageCanvas);

const sonifier = new OscillatorSonifier();
sonifier.configure({
  minFreq: 200,
  maxFreq: 700,
  minVol: 0,
  maxVol: 20,
  waveform: 'sine'
});

const app = new ApplicationController(detector, sampler, sonifier);
await app.start();
```

**Success criteria:**
- `main.ts` under 100 lines (bootstrap + UI wiring only)
- Core loop in `ApplicationController` is interface-driven (no concrete class dependencies)
- Existing one-channel behavior unchanged
- Tests for `ApplicationController` with mocked interfaces

---

## Phase 4: Alternative Implementations (Demonstrates Pluggability)

### Goal
Prove the architecture works by implementing alternative plugins that swap in cleanly.

### 4.1 Mouse Point Detector

**Create `src/detection/mouse/MousePointDetector.ts`:**
- Implements `PointDetector`
- Listens to `mousemove` events on canvas
- Emits single `DetectedPoint` with `id: "mouse"`
- Tests: simulate mouse events, verify callbacks

**Usage example:**
```typescript
// Swap one line to change from hands to mouse
const detector = new MousePointDetector(imageOverlayCanvas);
// Everything else stays the same!
```

### 4.2 MIDI Sonifier

**Create `src/sonification/MIDISonifier.ts`:**
- Implements `Sonifier`
- Internally maps hue (from ImageSample.data) to MIDI note numbers
- Maps value to velocity
- Uses Web MIDI API to send note-on/note-off
- Tests: mock Web MIDI API

**Usage example:**
```typescript
const sonifier = new MIDISonifier();
sonifier.configure({ outputDevice: 'IAC Driver Bus 1' });
const app = new ApplicationController(detector, sampler, sonifier);
// Now hand movements trigger MIDI notes instead of oscillators!
```

### 4.3 Three-Channel Sonifier (Not a separate app!)

**Create `src/sonification/StereoOscillatorSonifier.ts`:**
- Implements `Sonifier`
- Internally maps hue→frequency, saturation→pan, value→volume
- Adds `StereoPannerNode` to audio graph
- Reads all three HSV channels from ImageSample

**Usage example:**
```typescript
// Swap one line to get three-channel behavior
const sonifier = new StereoOscillatorSonifier();
sonifier.configure({ minFreq: 200, maxFreq: 700 });
// That's it! No new HTML entry point needed.
```

**Alternative approach:** Runtime mode switcher in UI
```typescript
const modeSelect = document.getElementById('sonifier-mode');
modeSelect.addEventListener('change', (e) => {
  const newSonifier = e.target.value === 'stereo'
    ? new StereoOscillatorSonifier()
    : new OscillatorSonifier();

  newSonifier.configure({ minFreq, maxFreq });
  app.updateSonifier(newSonifier);
});
```

### 4.4 Brightness Sampler

**Create `src/sampling/BrightnessImageSampler.ts`:**
- Implements `ImageSampler`
- Returns `{ data: { brightness, contrast } }`
- Tests: verify luminance calculation

**Works with existing sonifiers:**
```typescript
const sampler = new BrightnessImageSampler(canvas);
const sonifier = new OscillatorSonifier();
sonifier.configure({
  // Sonifier checks for 'brightness' instead of 'hue'
  minFreq: 200,
  maxFreq: 700,
  dataKey: 'brightness' // tells sonifier which data field to use
});
```

---

## Phase 5: Configuration & Presets

### Goal
Enable users to compose plugins without writing code.

### 5.1 JSON Configuration Format

**Create `src/core/config.schema.ts`:**

```typescript
export interface HerakoiConfig {
  detector: DetectorConfig;
  sampler: SamplerConfig;
  sonifier: SonifierConfig;
}

export type DetectorConfig =
  | { type: 'mediapipe', options: { maxHands: number, ... } }
  | { type: 'mouse', options: {} }
  | { type: 'touch', options: {} };

export type SamplerConfig =
  | { type: 'hsv', options: {} }
  | { type: 'brightness', options: {} };

export type SonifierConfig =
  | { type: 'oscillator', options: { minFreq: number, maxFreq: number, waveform: string } }
  | { type: 'stereo-oscillator', options: { minFreq: number, maxFreq: number } }
  | { type: 'midi', options: { outputDevice: string } };
```

**Create `src/core/PluginRegistry.ts`:**

```typescript
export class PluginRegistry {
  private detectors = new Map<string, typeof PointDetector>();
  private samplers = new Map<string, typeof ImageSampler>();
  private sonifiers = new Map<string, typeof Sonifier>();

  registerDetector(name: string, impl: typeof PointDetector) {
    this.detectors.set(name, impl);
  }

  registerSampler(name: string, impl: typeof ImageSampler) {
    this.samplers.set(name, impl);
  }

  registerSonifier(name: string, impl: typeof Sonifier) {
    this.sonifiers.set(name, impl);
  }

  buildFromConfig(config: HerakoiConfig): ApplicationController {
    const detector = this.buildDetector(config.detector);
    const sampler = this.buildSampler(config.sampler);
    const sonifier = this.buildSonifier(config.sonifier);

    return new ApplicationController(detector, sampler, sonifier);
  }

  private buildDetector(config: DetectorConfig): PointDetector {
    const Impl = this.detectors.get(config.type);
    if (!Impl) throw new Error(`Unknown detector: ${config.type}`);
    return new Impl(config.options);
  }

  private buildSampler(config: SamplerConfig): ImageSampler {
    const Impl = this.samplers.get(config.type);
    if (!Impl) throw new Error(`Unknown sampler: ${config.type}`);
    return new Impl(config.options);
  }

  private buildSonifier(config: SonifierConfig): Sonifier {
    const Impl = this.sonifiers.get(config.type);
    if (!Impl) throw new Error(`Unknown sonifier: ${config.type}`);
    const instance = new Impl();
    instance.configure(config.options);
    return instance;
  }
}
```

### 5.2 Preset Configurations

**Create `src/presets/one-channel-hands.json`:**
```json
{
  "detector": { "type": "mediapipe", "options": { "maxHands": 2 } },
  "sampler": { "type": "hsv", "options": {} },
  "sonifier": { "type": "oscillator", "options": { "minFreq": 200, "maxFreq": 700, "waveform": "sine" } }
}
```

**Create `src/presets/three-channel-hands.json`:**
```json
{
  "detector": { "type": "mediapipe", "options": { "maxHands": 2 } },
  "sampler": { "type": "hsv", "options": {} },
  "sonifier": { "type": "stereo-oscillator", "options": { "minFreq": 200, "maxFreq": 700 } }
}
```

**Create `src/presets/mouse-brightness.json`:**
```json
{
  "detector": { "type": "mouse", "options": {} },
  "sampler": { "type": "brightness", "options": {} },
  "sonifier": { "type": "oscillator", "options": { "minFreq": 200, "maxFreq": 700, "waveform": "triangle", "dataKey": "brightness" } }
}
```

### 5.3 Preset Loader

**Update `main.ts`:**
```typescript
import oneChannelPreset from '#src/presets/one-channel-hands.json';

const registry = new PluginRegistry();
// Register all available plugins
registry.registerDetector('mediapipe', MediaPipePointDetector);
registry.registerDetector('mouse', MousePointDetector);
registry.registerSampler('hsv', HSVImageSampler);
registry.registerSampler('brightness', BrightnessImageSampler);
registry.registerSonifier('oscillator', OscillatorSonifier);
registry.registerSonifier('stereo-oscillator', StereoOscillatorSonifier);
registry.registerSonifier('midi', MIDISonifier);

const app = registry.buildFromConfig(oneChannelPreset);
await app.start();
```

---

## Phase 6: Developer Experience & Documentation

### 6.1 Plugin Development Guide

**Create `docs/plugin-development.md`:**
- How to implement each interface
- Testing strategies for plugins
- Registration in PluginRegistry
- Example: step-by-step walkthrough of building a TouchPointDetector

### 6.2 Architecture Diagram

**Create `docs/architecture.md`:**
- Visual diagram showing the three-interface flow
- Example configurations with different plugin combinations
- Sequence diagram of point detection → sampling → sonification

### 6.3 API Documentation

**Add JSDoc to all interfaces:**
- Document coordinate systems
- Explain metadata conventions
- Provide usage examples

---

## Open Questions & Decisions Needed

### 1. Coordinate System Normalization
**Question:** Should `DetectedPoint` use normalized coordinates (0-1) or canvas pixels?

**Options:**
- **Normalized (0-1):** Detector-agnostic, works across different canvas sizes
- **Canvas pixels:** Simpler for samplers, avoids conversion overhead

**Recommendation:** Normalized coordinates. ApplicationController can handle scaling to canvas dimensions if needed.

---

### 2. Sample Data Structure
**Question:** Should `ImageSample.data` have fixed keys or be fully flexible?

**Options:**
- **Fixed:** `{ hue: number, saturation: number, value: number }` - type-safe but rigid
- **Flexible:** `Record<string, number>` - extensible but loses type safety

**Recommendation:** Flexible Record with conventions documented. Each Sonifier implementation validates the data keys it needs at runtime.

---

### 3. Multi-Point Rendering Strategy
**Question:** Who handles canvas drawing - controller, detector, or separate module?

**Current state:** Overlay utilities in `src/canvas/overlay.ts` called from main loop

**Proposed:**
- Create `Renderer` interface (additional abstraction?)
- Or keep rendering separate from the three core abstractions (view layer vs. model layer)

**Recommendation:** Keep rendering separate for now. It's a view concern, not part of the core detect→sample→sonify pipeline.

---

### 4. Plugin Distribution
**Question:** How do users discover and install third-party plugins?

**Future considerations:**
- NPM packages with naming convention (`herakoi-detector-*`, `herakoi-sampler-*`)?
- Plugin marketplace?
- Hot-loading from URLs?

**Recommendation:** Defer until core architecture stabilizes. Focus on built-in plugins first.

---

### 5. Configuration UI
**Question:** Should there be a visual preset selector, or JSON file upload only?

**Options:**
- Dropdown in UI to switch presets at runtime
- JSON upload field for custom configs
- Visual plugin builder (drag-and-drop?)

**Recommendation:** Start with runtime dropdown for built-in presets. Add JSON upload in Phase 5. Visual builder is long-term.

---

## Success Metrics

**Phase 3 (Interface Architecture):**
- [ ] Three core interfaces defined in `src/core/interfaces.ts`
- [ ] Existing implementations refactored to interfaces (tests still passing)
- [ ] `ApplicationController` orchestrates via interfaces only (no concrete imports in core loop)
- [ ] `main.ts` under 100 lines
- [ ] Test coverage maintained above 75%

**Phase 4 (Alternative Implementations):**
- [ ] Mouse detector swappable via one-line change
- [ ] MIDI sonifier functional with external DAW
- [ ] Three-channel behavior achieved via sonifier swap (no new HTML entry)
- [ ] Brightness sampler works with existing sonifiers
- [ ] Tests for all new plugins

**Phase 5 (Configuration System):**
- [ ] Three presets loadable from JSON
- [ ] Plugin registry instantiates correct implementations
- [ ] Runtime preset switching works without page reload

**Phase 6 (Documentation):**
- [ ] Plugin development guide published
- [ ] Architecture diagram in `docs/`
- [ ] All interfaces have JSDoc

---

## Timeline Estimate

**Phase 3 (Interface-Driven Architecture):** 2-3 weeks
- Week 1: Define interfaces, refactor existing code
- Week 2: Build ApplicationController, update main.ts, tests
- Week 3: Buffer for edge cases, documentation

**Phase 4 (Alternative Implementations):** 1-2 weeks
- Mouse detector: 1-2 days
- MIDI sonifier: 3-4 days (Web MIDI API learning curve)
- Three-channel sonifier: 2-3 days (stereo panning implementation)
- Brightness sampler: 1-2 days
- Tests: 2-3 days

**Phase 5 (Configuration System):** 1 week
- Registry: 2 days
- Presets + loader: 2 days
- UI integration: 1 day
- Tests: 2 days

**Phase 6 (Documentation):** Ongoing
- Write docs alongside implementation
- Final polish: 2-3 days

**Total:** 5-7 weeks for full plugin architecture

---

## Migration Path

**Step 1:** Define interfaces (no breaking changes)
**Step 2:** Create new implementations in parallel (old code untouched)
**Step 3:** Update main.ts to use new implementations (single commit, easy rollback)
**Step 4:** Deprecate old paths (keep exports working with warnings)
**Step 5:** Remove old files after one release cycle

**Rollback strategy:** Keep old implementations on feature branch until new architecture proven stable.

---

## Out of Scope (For Now)

- ❌ Three-channel as separate app (it's just a different sonifier implementation)
- ❌ Python prototype parity (focus on web implementation)
- ❌ Performance optimization (WebWorkers, WASM) - defer to Phase 7
- ❌ Mobile-specific features (gestures, orientation) - Phase 8
- ❌ Recording/export functionality - Phase 9
- ❌ Visual regression testing - Phase 10

---

## Notes

This roadmap supersedes:
- ~~`docs/improvement-plan-pr1.md`~~ (deleted - objectives completed)
- ~~`docs/pr1-bis-plan.md`~~ (deleted - controller extraction absorbed into Phase 3)

All ADRs in `docs/adrs/` remain authoritative.

**Last updated:** 2025-12-02 (revised: simplified to three core abstractions)
**Next review:** After Phase 3 completion
