# Repository Guidelines

## Project Structure & Module Organization
Active TypeScript lives in `src/`; `src/oneChannel` and `src/threeChannel` host the entrypoints, `src/vision` wraps MediaPipe helpers, `src/utils` carries shared types, and `src/style.css` centralizes styling. Legacy experiments remain in `legacy_html/` for baseline comparisons, with docs, ADRs, and improvement plans stored in `docs/`. Vite emits builds into `dist/`, and the root HTML files (`index.html`, `one-channel.html`, `three-channel.html`) cover lightweight hosting needs.

## Build, Test, and Development Commands
- `pnpm dev` starts Vite with HMR for local iteration.
- `pnpm build` emits the production bundle; follow with `pnpm preview` for a static smoke test.
- `pnpm lint` runs Biome plus both `tsc` configs, and `pnpm format` applies Biome’s autofixes.
- `pnpm typecheck` isolates TypeScript validation, while `pnpm test` executes Vitest suites (use `--watch` when iterating).

## Coding Style & Naming Conventions
We target Node 22+, native ES modules, strict TypeScript, and 2-space indentation. Use descriptive PascalCase components (`HandsDetector`), camelCase utilities, and kebab-case CSS class names. Biome stays authoritative for lint/format—run it before committing. Comments stick to the narrative why/what/how flow so future readers understand intent and expected behavior.

## Testing Guidelines
Treat tests as layered guardrails: fast Vitest unit specs live beside their modules with a `.test.ts` suffix, integration checks exercise MediaPipe wiring plus audio or camera mocks, and manual smoke tests confirm the demo HTML entrypoints. Wherever we stub browsers or hardware, describe the contract we expect (e.g., landmark payload shape, canvas dimensions) so future contributors can extend coverage without reverse-engineering intent. Keep targeting ~80% line coverage, and explain any purposeful gaps plus follow-up actions in the PR description.

## Commit & Pull Request Guidelines
Match the existing `type: summary` pattern (`build: add three-channel Vite entry`, `ui: promote static landing page`). Keep subjects imperative and concise, reference issues in the body, and describe manual verification steps (commands, screenshots, or audio captures). Pull requests should link the relevant doc or ADR when architecture shifts, and note how legacy HTML parity was validated whenever those files move.

## Task Planning & ADR Alignment
When starting any task, first capture a short checklist-style plan (three to five steps is ideal) so reviewers can track progress as we tick off items. Reference the ADRs under `docs/` and ensure new code follows their prescribed patterns; call out the ADR you followed (or updated) in the PR description. Keep using the asset-loader helpers in `src/vision/hands.ts`, stick to `pnpm@10.20.0`, and document new permission or configuration needs alongside the plan so downstream reviewers know what to validate.
