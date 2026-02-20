# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Vite dev server (http://localhost:5173)
pnpm dev:https    # HTTPS dev server (required for camera on mobile)
pnpm build        # Production build → dist/
pnpm lint         # biome check + eslint a11y + typecheck (all three)
pnpm lint:biome:fix  # Auto-fix Biome issues (run before committing manually)
pnpm typecheck    # TypeScript only (tsc --noEmit)
pnpm test         # Full Vitest suite (--pool=threads)
pnpm commit       # Commitizen prompt for conventional commits
```

Run a single test file: `pnpm vitest run src/plugins/detection/mediapipe/plugin.test.tsx`

## Architecture Overview

Herakoi is a **webcam hand-tracking sonification app**: MediaPipe detects hand landmarks → pixel colors at those points are sampled → colors are converted to audio via Web Audio API.

### Plugin Pipeline

The app is built around a **compile-time plugin system** with four pipeline slots:

| Slot | Interface | Current implementation |
|------|-----------|----------------------|
| `detection` | `PointDetector` | `mediapipe/` — MediaPipe Hands |
| `sampling` | `ImageSampler` | `hsv/` — HSV color space sampler |
| `sonification` | `Sonifier` | `oscillator/` — Web Audio oscillators |
| `visualization` | *(optional)* | `debugHud/` — Canvas overlay |

**Data flow:** Video → MediaPipe → normalized (0–1) points → pixel color samples (`{h,s,v,...}`) → oscillator tones → speakers.

**Plugin discovery** (`src/engineConfig.ts`): Uses `import.meta.glob()` to find all `src/plugins/<kind>/<name>/plugin.ts(x)` files at build time. The path determines the plugin's `kind` and `id` (e.g. `detection/mediapipe`).

**Plugin isolation**: Biome enforces that plugins only import from `#src/core/*`, `#src/shared/*`, or other plugins — never from shell/app code. Adding a new plugin means creating a directory under `src/plugins/<kind>/<name>/` with a `plugin.ts(x)` entry exporting a typed plugin object.

### Key Source Directories

```
src/
├── core/           # Pipeline interfaces (PointDetector, ImageSampler, Sonifier) + plugin slot types
├── plugins/        # All pipeline implementations (detection/mediapipe, sampling/hsv, etc.)
├── shared/         # Components/hooks/utils shared by plugins and shell (Radix UI wrappers, cn utility)
├── components/     # Shell UI (App.tsx, SettingsPanel, header, error boundary)
├── state/          # Zustand stores (appConfigStore persisted, appRuntimeStore ephemeral)
├── hooks/          # useSonificationEngine (pipeline orchestrator), usePluginUi, idle/dim hooks
├── lib/            # analytics.ts (SimpleAnalytics), SunburstMark.ts
├── engineConfig.ts # Plugin registry (static, type-safe)
└── main.tsx        # React root
```

### State Management

- **`appConfigStore`** — persisted to `localStorage` via Zustand persist middleware. Holds active plugin IDs per slot, per-plugin configs, and UI preferences. Supports `exportConfig()`/`importConfig()` for backup/restore.
- **`appRuntimeStore`** — ephemeral pipeline status (`idle | initializing | running | error`).
- **`notificationStore`** — toast notifications.

Plugin configs are stored as `pluginConfigs[pluginId]` inside `appConfigStore`, typed per-plugin. Plugins read/write config through a `PluginRuntimeContext` passed by `useSonificationEngine`.

### Import Aliases

`#src/*` is defined in `package.json`'s `"imports"` field (not tsconfig paths). It resolves against `./src/`:

```ts
import { foo } from "#src/core/interfaces"      // → src/core/interfaces.ts
import { cn } from "#src/shared/utils/cn"        // → src/shared/utils/cn.ts
```

### Linting & Pre-commit

- **Biome** handles formatting and most linting (2-space indent, 100-char lines, double quotes).
- **ESLint** handles only accessibility rules (`eslint-plugin-jsx-a11y`) — documented in ADR 005.
- **Lefthook** runs on `pre-commit`: (1) biome fix, (2) biome lint + typecheck in parallel, (3) `vitest --changed`. If biome fix changes files, the commit aborts so you can review and re-stage.
- Use `pnpm commit` (Commitizen) to author conventional commit messages; Commitlint validates at `commit-msg`.

### Analytics

`src/lib/analytics.ts` wraps SimpleAnalytics. In `dev`, events are console-logged only. Import from this file to add tracking to new features.

### Tests

Tests are collocated with source (`.test.ts`/`.test.tsx` next to the file they test). Test environment is `happy-dom`. The pre-commit hook only runs tests for changed files; `pnpm test` runs everything.
