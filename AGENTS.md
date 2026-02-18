# Repository Guidelines

## Project Structure & Module Organization
Active TypeScript lives in `src/`. The React app is hosted by `index.html` and bootstrapped from `src/app/main.tsx` into `src/app/App.tsx`. UI is split into `src/app/components/header/*` (top toolbar), `src/app/components/panels/*` (settings bodies), and `src/app/components/ui/*` (primitives). App hooks live in `src/app/hooks/*` (image library, dimming, tone sampling, cover pan) and app state is in `src/app/state/pipelineStore.ts`. Curated assets and metadata live in `src/app/assets/*` and `src/app/data/*`.

The in-browser pipeline is the "backend" for the UI; there is no server/API in this repo. Core contracts are in `src/core/interfaces.ts`, orchestration is in `src/core/ApplicationController.ts`, and implementations live in `src/detection/mediapipe/*`, `src/sampling/hsv/*`, and `src/sonification/oscillator/*`. Debug tooling is in `src/debug/*`. Legacy comparisons live in `legacy_html/`. Vite emits to `dist/`. The root HTML entrypoint is `index.html`.

Use `#src/*` import aliases when crossing folders (see ADR 003/004 under `docs/adrs/`); keep relative imports for siblings.

## Build, Test, and Development Commands
- `pnpm dev` starts Vite with HMR; open `/`.
- `pnpm build` emits the production bundle; follow with `pnpm preview` and open `/`.
- `pnpm lint` runs Biome plus both `tsc` configs; `pnpm format` applies Biome autofixes.
- `pnpm typecheck` isolates TypeScript validation; `pnpm test` runs Vitest (use `--watch` when iterating).
- Lefthook’s pre-commit hook runs Biome fix -> Biome lint + TypeScript -> Vitest.

## Coding Style & Naming Conventions
Target Node 22+, native ES modules, strict TypeScript, and 2-space indentation. Use descriptive PascalCase components (`HandsDetector`), camelCase utilities, and kebab-case CSS class names. Biome is authoritative for lint/format. Comments should explain intent and behavior (why/what/how). Prefer imperative canvas updates for high-frequency drawing to avoid React re-render churn.

## Testing Guidelines
Treat tests as layered guardrails: unit Vitest specs live beside modules with a `.test.ts` suffix, integration checks exercise MediaPipe wiring plus audio/camera mocks, and manual smoke tests confirm the HTML entrypoint. For manual checks, verify `/` (image import/selection, cover pan, transport controls) and PiP camera overlays/mirror. Describe stubbed browser/hardware contracts (landmark payloads, canvas dimensions) in tests to make extensions predictable.

## Commit & Pull Request Guidelines
- Use the `type: summary` subject pattern (e.g., `build: add three-channel Vite entry`) and keep bodies focused on intent plus links.
- Add a short “Verification” note with commands or observations (commands, screenshots, audio captures).
- Lefthook already runs Biome fix, Biome lint, TypeScript, and Vitest; run `pnpm lint`, `pnpm test`, or `pnpm build` manually only when you want extra signal.
- `git commit` (no `-m`) launches Commitizen via `prepare-commit-msg`; run `pnpm commit` if you want the wizard directly.
- For automation/headless commits, use `CI=1 git commit -m "type: summary"` to bypass Commitizen while keeping commitlint.
- Reference relevant ADRs for architecture shifts and call out parity validation with legacy demos when touched.

## Task Planning & ADR Alignment
Start each task with a short checklist-style plan (3–5 steps). Reference ADRs under `docs/adrs/` and follow their patterns. Keep using the curated asset loader pattern in `src/app/data/curatedImages.ts` (`import.meta.glob`) and the MediaPipe helpers under `src/detection/mediapipe/`. Document any new permission or configuration needs alongside the plan, especially camera/audio constraints for mobile browsers.

## README Voice & Maintenance
Use README updates to welcome first-time contributors and explain the workflow in plain language. Lead each section with the purpose (“why”) before listing steps or commands, keep the tone collaborative (“we”/“our”), and spell out what runs automatically (Lefthook chain) versus what contributors run manually. Prefer short paragraphs over long bullet walls, and explain new tooling or conventions with both how to run them and why they exist.
