# ADR 006: Plugin Architecture - State Isolation and Dependency Inversion

## Status

**Accepted** – February 11, 2026

## Context

The Herakoi application follows a three-stage pipeline architecture:
- **Detection** → Hand/gesture tracking (currently MediaPipe Hands)
- **Sampling** → Image color extraction (currently HSV color sampler)
- **Sonification** → Audio synthesis (currently Web Audio oscillators)

Each stage is pluggable via compile-time composition defined in `pipelineConfig.ts`. Early plugin implementations coupled plugins tightly to shell state, creating issues:

1. **Detection-specific state in shell store**: `handDetected` lived in `pipelineStore` despite being MediaPipe-specific, preventing alternative detection plugins from managing their own detection state
2. **Direct store imports in plugins**: Plugins imported `usePipelineStore` directly, making them untestable in isolation and fragile to shell refactoring
3. **Hardcoded shell behaviors**: Hand prompt notifications and idle-dimming logic were hardcoded in the shell (App.tsx), making them impossible to customize or disable for alternative detection methods
4. **Opaque plugin capabilities**: No clear interface for what plugins could do (show notifications, control UI, draw overlays)

These issues became apparent when considering future plugins:
- A **mouse detector** plugin wouldn't have "hands detected" but would still need notifications
- A **face tracker** might want different dimming behavior (focus button vs. idle detection)
- Alternative **sonification** plugins might need different configuration UI

The architecture needed clear boundaries: **what belongs to plugins vs. what belongs to the shell?**

## Decision

We adopt the following principles for plugin architecture:

### 1. Plugin State Isolation

**Rule**: Plugins own their domain-specific state in their own Zustand stores. Plugins NEVER import shell stores (`pipelineStore`, `notificationStore`).

**Implementation**:
- MediaPipe detection plugin has `useMediaPipeDetectionStore` with `mirror`, `maxHands`, `facingMode`, `handDetected`
- Future plugins create their own stores (e.g., `useMouseDetectionStore`, `useFaceTrackingStore`)
- Shell remains ignorant of plugin-specific state

**Rationale**: Testability (plugins can be tested without shell), modularity (plugins are self-contained), flexibility (different plugins can have radically different state models).

### 2. Dependency Inversion for Shell Capabilities

**Rule**: The shell passes all state and actions to plugins via props/callbacks. Plugins receive capabilities through well-defined interfaces.

**Implementation**:
- `DockPanelProps`: Plugin dock panels receive `isRunning`, `isInitializing`, `onStart`, `onStop`, `setUiOpacity`
- `PipelineCallbacks`: Plugin lifecycle hooks receive `showNotification`, `hideNotification`
- Shell owns the stores, plugins receive accessors as parameters

**Rationale**: Dependency inversion keeps plugins decoupled from shell implementation. The shell can refactor its state management without breaking plugins. Plugins declare their needs via interfaces.

### 3. Plugin-Controlled UI Behaviors

**Rule**: Plugins control UI behaviors (notifications, dimming) specific to their detection method. The shell provides mechanisms, plugins provide policy.

**Implementation**:
- **Notifications**: Shell provides `useNotificationStore` with `show(id, data)`, `hide(id)`, `clearAll()` API. Plugins call these via callbacks to show hand prompts, error messages, etc.
- **UI Dimming**: Shell provides `uiOpacity` state (0-1 scale) and renders fade transitions. Plugins call `setUiOpacity(n)` to set exact opacity. Shared utility `useIdleDimmer` helps plugins implement idle detection, but plugins can also use direct opacity control (e.g., a focus button).
- **Rendering**: Shell provides `<PluginNotifications />` component that renders all active notifications from the store.

**Rationale**: Different detection methods have different UX needs. MediaPipe uses idle dimming (hands detected + mouse idle → dim UI). A mouse detector might use a focus button (click → dim UI immediately). This flexibility requires plugins to own the policy while the shell provides the mechanism.

### 4. Plugin Visualization Ownership

**Rule**: Plugins own their visualization logic. The shell provides canvas elements; plugins decide what to draw.

**Implementation**:
- Shell renders overlay `<canvas>` elements in App.tsx (image overlay) and DockPanel (video overlay)
- Plugins register canvas refs via `registerOverlayRef(name, ref)`
- Plugin `postInitialize()` hook calls `bindHandsUi(detector, canvases)` to subscribe to detection events and draw on canvases
- Drawing uses standard Canvas 2D API - no shell-provided drawing helpers

**Rationale**: Different detectors need different visualizations (hand skeleton, bounding boxes, face mesh). The shell shouldn't dictate visualization style. Plugins have full control over their rendering.

### 5. Three-Stage Pipeline Composition

**Rule**: The pipeline requires one active plugin per stage (detection, sampling, sonification). All three are necessary; none are optional.

**Implementation**:
- `pipelineConfig.ts` defines available plugins per stage
- `pipelineStore` tracks active plugin IDs (`activeDetectionId`, `activeSamplingId`, `activeSonificationId`)
- `usePipeline` hook instantiates active plugins and wires them together
- Data flows: Detection (coordinates) → Sampling (colors at coordinates) → Sonification (audio from colors)

**Rationale**: The three stages represent distinct concerns. Detection produces spatial data, sampling produces feature data, sonification produces output. Keeping these separate allows mixing and matching (e.g., MediaPipe hands + RGB sampling + MIDI sonification).

## Consequences

### Positive

- **Testability**: Plugins can be tested in isolation without mounting the entire shell
- **Modularity**: Plugins are self-contained units with clear dependencies
- **Flexibility**: Alternative detection methods (mouse, face tracking, pose estimation) can provide different UX without shell changes
- **Maintainability**: Shell refactoring doesn't break plugins (as long as interfaces remain stable)
- **Reusability**: Shared utilities (`useIdleDimmer`) can be used by any plugin needing similar behavior

### Negative

- **Boilerplate**: Plugin authors must create their own stores instead of using shell state
- **Indirection**: Props/callbacks add a layer of indirection compared to direct store imports
- **Learning curve**: New contributors must understand dependency inversion pattern

### Neutral

- **Interface stability required**: Shell must maintain stable `DockPanelProps` and `PipelineCallbacks` interfaces. Breaking changes require coordinated updates to all plugins.
- **Canvas ref registration**: Plugin visualization requires ref registration system (`registerOverlayRef`). This is a necessary coupling point but should remain minimal.

## References

### Related ADRs

- ADR 003: Package import alias strategy (how plugins import from `#src/*`)
- ADR 004: Package import map with TypeScript Bundler resolver (module resolution for plugins)

### Key Files

- `src/core/plugin.ts` - Plugin type definitions and interfaces
- `src/core/interfaces.ts` - Core detection/sampling/sonification interfaces
- `src/app/pipelineConfig.ts` - Plugin composition configuration
- `src/detection/mediapipe/plugin.tsx` - Reference implementation
- `src/detection/mediapipe/store.ts` - Example plugin-local state
- `src/app/state/notificationStore.ts` - Shell notification mechanism
- `src/app/hooks/useIdleDimmer.ts` - Shared utility for plugin UX
