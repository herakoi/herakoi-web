# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Herakoi is a motion-sensing sonification experiment that tracks hand movements via webcam using MediaPipe machine learning, re-projects landmarks onto reference images, and converts pixel color/brightness into audio. The web implementation uses TypeScript + Vite and maintains parity with the Python prototype at [herakoi/herakoi](https://github.com/herakoi/herakoi).

## Commands

### Development
- `pnpm install` - Install dependencies (auto-runs `lefthook install` via postinstall hook)
- `pnpm dev` - Start Vite dev server with HMR
- `pnpm build` - Build production bundle to `dist/`
- `pnpm preview` - Preview production build locally

### Quality Checks
- `pnpm lint` - Run both Biome linter and TypeScript checks across all configs
- `pnpm lint:biome` - Run Biome linter only
- `pnpm lint:biome:fix` - Auto-fix Biome issues (runs with --unsafe flag)
- `pnpm format` - Format code with Biome
- `pnpm typecheck` - Run TypeScript compiler checks on `tsconfig.json` and `tsconfig.node.json`
- `pnpm test` - Run full Vitest test suite
- `pnpm test --watch` - Run Vitest in watch mode for iterative development
- `pnpm test --changed` - Run tests only for changed files (used by pre-commit hook)

### Commits
- `pnpm commit` - Launch Commitizen wizard for guided conventional commits
- `git commit` (no `-m`) - Also launches Commitizen via prepare-commit-msg hook
- `CI=1 git commit -m "type: message"` - Bypass Commitizen wizard for automated/scripted commits

**Important**: The prepare-commit-msg hook launches Commitizen regardless of whether you use `-m` flag. In interactive terminals with TTY access, `git commit -m "message"` will still open the Commitizen wizard and wait for input, ignoring your provided message. The `CI=1` environment variable is the only way to skip the wizard and use direct commit messages. In non-interactive environments (like CI/CD or automated tools without TTY), Commitizen fails silently and git falls back to the `-m` message.

## Architecture

### Entry Points and Modes
The app has three main HTML entry points configured in `vite.config.ts`:
- `index.html` - Landing page
- `one-channel.html` (`src/oneChannel/main.ts`) - Single-channel sonification mapping hue→frequency and value→volume
- `three-channel.html` (`src/threeChannel/main.ts`) - Three-channel sonification mapping hue→frequency, saturation→pan, value→volume

### Core Module Structure

**Vision Pipeline** (`src/vision/`):
- `hands.ts` - `HandsDetector` class wraps MediaPipe Hands solution with bundled asset resolution. Uses Vite's `?url` imports to map all WASM/model files via a `locateFile` handler, replacing CDN dependencies from legacy HTML
- `handGeometry.ts` - Finger focus calculation (identifies which fingertip to sonify)
- `imageEncoding.ts` - `ImageSampler` class handles canvas-to-pixel sampling, RGB→HSV conversion, and coordinate-based pixel lookups

**Audio Pipeline** (`src/audio/`):
- `sonification.ts` - `Sonifier` class manages Web Audio API with tone lifecycle (create/update/stop). Maintains a map of active `ToneId → {oscillator, gain}` pairs, supports configurable oscillator types, and handles fade-out when tones stop

**Rendering** (`src/canvas/`):
- `overlay.ts` - Drawing utilities for hand landmarks, finger focus boxes, and frequency labels on canvas contexts

**Debug Tools** (`src/debug/`):
- `index.ts` - Setup function for debug panel
- `panel.ts` - UI panel rendering
- `consoleSonifier.ts` - Console-based tone logging

**Shared** (`src/utils/`):
- `types.ts` - Common type definitions

### MediaPipe Asset Bundling Strategy
MediaPipe Hands requires 9 specific files (WASM binaries, models, graphs). The `HandsDetector` class in `src/vision/hands.ts` imports each as `@mediapipe/hands/<file>?url` and provides a `locateFile` function that maps MediaPipe's runtime file requests to Vite-bundled URLs. This keeps assets local and eliminates CDN dependencies.

### Audio Architecture
The `Sonifier` class uses a tone-per-fingertip model where each active finger gets a unique `ToneId` (e.g., `"hand-0-index-tip"`). Every frame calls `syncTones(updates[])` which:
1. Updates existing tones or creates new oscillator/gain pairs
2. Stops tones not present in the current frame with exponential fade-out
3. Cleans up disconnected nodes asynchronously

This design supports multiple simultaneous hands without tone conflicts.

### Image Sampling Flow
1. User uploads image or default zodiac constellation loads
2. Image drawn to `sourceImageCanvas`
3. `ImageSampler` captures `ImageData` and pre-converts all pixels to HSV, storing hue/value bytes in internal buffers
4. Each frame, `getFingerFocus()` computes fingertip coordinates in canvas space
5. `ImageSampler.sampleAtPixel(x, y)` returns pre-computed HSV bytes
6. Main loop maps bytes to audio parameters (frequency/volume) and updates `Sonifier`

This pre-computation strategy (done once on upload) keeps per-frame pixel lookups fast.

### Testing Strategy
Tests use Vitest and live beside source files with `.test.ts` suffix. Key test patterns:
- `hands.test.ts` - Validates asset mapping and MediaPipe wrapper construction
- `imageEncoding.test.ts` - Tests RGB→HSV conversion and pixel sampling with known color values
- `sonification.test.ts` - Uses mock `AudioContext` to verify tone lifecycle (create/update/stop/fade)

Tests targeting ~80% line coverage. Integration tests mock browser APIs (canvas, audio, camera) with explicit contract descriptions.

## Important Conventions

### Module Resolution
Package uses `"imports"` field in `package.json` to define `#src/*` alias mapping to `./src/*.ts`. TypeScript config uses `moduleResolution: "Bundler"` which respects this Node.js subpath import pattern. See ADR 004 (`docs/adrs/004-package-import-map-ts-bundler.md`) for rationale.

### TypeScript Configuration
Two tsconfig files (ADR 001):
- `tsconfig.json` - Covers `src/**/*.ts` (application code)
- `tsconfig.node.json` - Covers `vite.config.ts` and other Node build scripts

Both use strict mode, ES2022 target, and ESNext modules.

### Legacy HTML Preservation
`legacy_html/` contains read-only baseline implementations. Vite plugin `copyLegacyHtmlPlugin()` copies this directory to `dist/legacy_html/` during builds for behavior comparison.

### Git Hooks (Lefthook)
`lefthook.yml` configures three hooks:

**pre-commit** (sequential):
1. `biome-fix` - Auto-applies Biome fixes, restages changed files
2. `code-health` - Parallel execution of `biome` lint + `typecheck`
3. `vitest` - Runs tests with `--changed` flag (only touches files in current diff)

**prepare-commit-msg**:
- Launches Commitizen wizard for interactive conventional commit authoring
- Skipped when `CI=1` environment variable is set

**commit-msg**:
- Runs commitlint to validate conventional commit format

### Commit Message Format
Use conventional commits format: `type: summary` where type is one of: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore`. Include verification notes describing commands run or behavior observed.

### Biome as Authoritative Linter
Biome handles both linting and formatting. Configuration in `biome.jsonc`. Run Biome fix before committing (happens automatically via pre-commit hook).

### Code Style
- 2-space indentation
- PascalCase for classes (`HandsDetector`, `Sonifier`)
- camelCase for functions and variables
- kebab-case for CSS classes
- Target Node 22+ (see `engines` in `package.json`)
- Native ES modules only (`"type": "module"`)
- Strict TypeScript

### Documentation Comments
Use narrative why/what/how comments that explain intent and expected behavior. See examples in `src/vision/hands.ts` and `src/audio/sonification.ts`.

## Reference Materials

- `AGENTS.md` - Collaboration guidelines for AI agents, includes module organization and development flow details
- `docs/adrs/` - Architecture Decision Records documenting tsconfig strategy, import aliases, and blame-ignore rationale
- `docs/improvement-plan-pr1.md` - Initial TypeScript migration plan
- `README.md` - User-facing getting started guide
