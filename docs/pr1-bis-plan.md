# PR1.Bis Modernization Plan (One-Channel Module Refactor)

## Goals
- Break the monolithic `src/oneChannel/main.ts` into purpose-specific modules that are easy to reason about and extend.
- Keep tests colocated next to their implementation (`*.test.ts`) so changes stay discoverable.
- Follow a red-green workflow: land each module’s tests first, pause for review feedback, then implement just enough code to make them pass.

## Proposed Module Map
1. `src/vision/hands.ts`  
   - Responsibility: provide a focused TypeScript class that wraps the MediaPipe `Hands` instance, handles asset resolution, and exposes a clean API (`initialize`, `setOptions`, `onResults`, `processFrame`). We will treat it as a service object so the controller can manage its lifecycle without owning MediaPipe details.  
   - Tests: ensure bundled assets resolve locally, configuration errors throw meaningful messages, and MediaPipe APIs are invoked as expected (using Vitest spies/mocks).  
   - Collaborators: `Hands`, MediaPipe asset URLs, the camera feed.

2. `src/vision/imageEncoding.ts`  
   - Responsibility: pure helpers that encode image data for sonification (HSV conversion, byte packing).  
   - Tests: deterministic math verification without DOM dependencies.  
   - Collaborators: none (pure functions).

3. `src/audio/sonification.ts`  
   - Responsibility: translate encoded pixels into `{frequency, volume}` pairs and wrap the oscillator/gain lifecycle (`startTone`, `updateTone`, `stopTone`).  
   - Tests: pure math tests for frequency/volume plus Web Audio mocks for node lifecycle.  
   - Collaborators: Web Audio API (mocked).

4. `src/canvas/overlay.ts`  
   - Responsibility: drawing utilities (mirroring landmarks, rendering overlays, managing canvas sizing).  
   - Tests: focus on pure computations (e.g., mirroring coordinates) and verify draw routines receive expected parameters via spies.

5. `src/oneChannel/controller.ts`  
   - Responsibility: orchestrate DOM bindings, connect camera frames to helpers, and glue everything together using the modules above.  
   - Tests: high-level integration with lightweight DOM stubs; controller lives alongside the view because it is feature-specific.

## Workflow
1. For each module, author a colocated test file (e.g., `vision/hands.test.ts`) with extensive documentation comments.  
2. Pause for review before writing the implementation.  
3. Implement the module, adjust `oneChannel/controller.ts` to use it, and document within the module (e.g., block comments or JSDoc) which legacy lines in `legacy_html/herakoi_web_test/herakoi.html` inspired or correspond to each major section.  
4. Repeat until all logic migrates out of the legacy `main.ts`.
5. When files import code outside their immediate directory, rely on the `#src/*` package import alias instead of chained `../` segments; keep short relative imports only for siblings or deeper paths within the same folder so that colocated tests remain readable.

## Open Questions
- Do we want the controller to expose a `bootstrapOneChannelApp()` function (exported for future reuse/tests) or keep the initialization side-effect-only?  
- Should we introduce a lightweight event emitter to decouple MediaPipe callbacks from audio updates, or keep direct function calls for now?

Let me know if we should tweak the module boundaries or naming before proceeding with the first red test.
