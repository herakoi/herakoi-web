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

## Development Methodology

**Test-Driven Development (TDD) - MANDATORY**

All implementation work MUST follow the Red-Green-Refactor cycle:

1. **Red** - Write failing tests first
   - Define the interface contract through tests
   - Specify expected behavior before implementation
   - Tests should fail initially (red)

2. **Green** - Write minimal code to pass tests
   - Implement just enough to make tests pass
   - Focus on correctness, not optimization
   - All tests should pass (green)

3. **Refactor** - Improve code quality
   - Clean up implementation while keeping tests green
   - Improve naming, structure, and patterns
   - Ensure tests still pass after refactoring

**Implementation workflow:**
- Discuss implementation strategy before writing code
- Write tests defining the contract and behavior
- Implement to satisfy tests
- Refactor for quality
- Repeat for next component

---

## Current Status

**Phase 1: Modern Tooling** - **COMPLETE**
- [x] TypeScript + Vite, pnpm, Biome, Vitest, Lefthook, PostCSS

**Phase 2: Initial Module Extraction** - **85% COMPLETE**
- [x] Vision modules (`HandsDetector`, `ImageSampler`, `handGeometry`)
- [x] Audio module (`Sonifier`)
- [x] Canvas utilities (`overlay`)
- [x] Test coverage (8 tests passing)
- [x] Extract interfaces so `PointDetector` / `ImageSampler` / `Sonifier` become swappable contracts instead of concrete classes
- [ ] Move orchestration into `src/modular/main.ts` while keeping `src/oneChannel/main.ts` frozen as the behavioral reference
- [ ] Add the first plugin composition system in `src/modular/main.ts`

**Focus:** All new implementation work now targets the modular touchpoint (`src/modular/main.ts`) so we can keep `src/oneChannel/main.ts` unchanged as a behavioral reference during the refactor.

---

## Phase 3: Interface-Driven Architecture (Immediate Priority)

### Parity Check: modular vs one-channel

When we touch `src/modular/main.ts`, keep `src/oneChannel/main.ts` as the behavioral reference:
- Manual smoke: load both modular and one-channel pages, confirm fingertip focus, hand overlays, and tone response match for the default image and camera.
- Automated: run `pnpm test` (Vitest) and `pnpm tsc --noEmit`; these cover factories, controls, and detector plumbing. The one-channel entry stays intentionally unchanged—if behavior diverges, note it here with rationale and next steps.
- If modular introduces a new plug-in, document how to toggle it (config or factory) and what parity gap remains.

### Goal
Define and implement the three core abstractions as TypeScript interfaces, refactor existing code to conform, and create a composition system that wires them together. We are now applying this work to the new `modular.html` touchpoint (`src/modular/main.ts`) instead of the legacy `src/oneChannel/main.ts`, so the controller wiring should target the modular entry first and backport only if needed.

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

- Refactor `src/vision/imageEncoding.ts` → `src/sampling/hsv/HSVImageSampler.ts`
  - Current `ImageSampler` class becomes `HSVImageSampler`
  - Implements `ImageSampler` interface
  - Returns `{ data: { hue, saturation, value } }`
  - Tests: Update existing `imageEncoding.test.ts` → `hsv/HSVImageSampler.test.ts`

- Refactor `src/audio/sonification.ts` → `src/sonification/oscillator/OscillatorSonifier.ts`
  - Current `Sonifier` class becomes `OscillatorSonifier`
  - Implements `Sonifier` interface
  - Internally maps ImageSample data (hue→frequency, value→volume) to oscillator nodes
  - Tests: Update `sonification.test.ts` → `oscillator/OscillatorSonifier.test.ts`

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

**Update `src/modular/main.ts` to use composition (primary target):**

```typescript
import { ApplicationController } from '#src/core/ApplicationController';
import { MediaPipePointDetector } from '#src/detection/mediapipe/MediaPipePointDetector';
import { HSVImageSampler } from '#src/sampling/hsv/HSVImageSampler';
import { OscillatorSonifier } from '#src/sonification/oscillator/OscillatorSonifier';

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
- `src/modular/main.ts` under 100 lines (bootstrap + UI wiring only)
- Core loop in `ApplicationController` is interface-driven (no concrete class dependencies)
- Existing one-channel behavior unchanged
- Tests for `ApplicationController` with mocked interfaces
- `index.html` links to `modular.html` as the active development touchpoint; legacy `one-channel.html` and `three-channel.html` stay in the repo but are removed from primary navigation to reduce confusion.

---

## Post-Modular Work (moved)

All postponed work now lives in `docs/post-modular-roadmap.md` to keep this document focused on Phase 3 delivery.

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

**Phase 4 (Alternative Implementations):** *postponed*
- [ ] Mouse detector swappable via one-line change
- [ ] MIDI sonifier functional with external DAW
- [ ] Three-channel behavior achieved via sonifier swap (no new HTML entry)
- [ ] Brightness sampler works with existing sonifiers
- [ ] Tests for all new plugins

**Phase 5 (Configuration System):** *postponed*
- [ ] Three presets loadable from JSON
- [ ] Plugin registry instantiates correct implementations
- [ ] Runtime preset switching works without page reload

**Phase 6 (Documentation):** *postponed*
- [ ] Plugin development guide published
- [ ] Architecture diagram in `docs/`
- [ ] All interfaces have JSDoc

---

## Timeline Estimate

**Phase 3 (Interface-Driven Architecture):** 2-3 weeks
- Week 1: Define interfaces, refactor existing code
- Week 2: Build ApplicationController, update main.ts, tests
- Week 3: Buffer for edge cases, documentation

**Phase 4 (Alternative Implementations):** *postponed*
- Mouse detector: 1-2 days (deferred)
- MIDI sonifier: 3-4 days (deferred; Web MIDI API learning curve)
- Three-channel sonifier: 2-3 days (deferred; stereo panning implementation)
- Brightness sampler: 1-2 days (deferred)
- Tests: 2-3 days (deferred)

**Phase 5 (Configuration System):** *postponed*
- Registry: 2 days (deferred)
- Presets + loader: 2 days (deferred)
- UI integration: 1 day (deferred)
- Tests: 2 days (deferred)

**Phase 6 (Documentation):** *postponed*
- Write docs alongside implementation (deferred)
- Final polish: 2-3 days (deferred)

**Total:** Phase 3 in-flight; overall timeline will be re-estimated when phases 4-6 are rescheduled.

---

## Migration Path

**Step 1:** Define interfaces (no breaking changes)
**Step 2:** Create new implementations in parallel (old code untouched)
**Step 3:** Update `modular.html` / `src/modular/main.ts` to use new implementations and point `index.html` at `modular.html`; remove `one-channel.html` and `three-channel.html` from main links (keep files for reference)
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
