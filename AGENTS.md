# Repository Guidelines

## Project Structure & Module Organization
Active TypeScript lives in `src/`; `src/oneChannel` and `src/threeChannel` host the entrypoints, `src/vision` wraps MediaPipe helpers, `src/utils` carries shared types, and `src/style.css` centralizes styling. Legacy experiments remain in `legacy_html/` for baseline comparisons, with docs, ADRs, and improvement plans stored in `docs/`. Vite emits builds into `dist/`, and the root HTML files (`index.html`, `one-channel.html`, `three-channel.html`) cover lightweight hosting needs.

## Build, Test, and Development Commands
- `pnpm dev` starts Vite with HMR for local iteration.
- `pnpm build` emits the production bundle; follow with `pnpm preview` for a static smoke test.
- `pnpm lint` runs Biome plus both `tsc` configs, and `pnpm format` applies Biome’s autofixes.
- `pnpm typecheck` isolates TypeScript validation, while `pnpm test` executes Vitest suites (use `--watch` when iterating).
- Lefthook’s `pre-commit` hook now auto-runs Biome fix → Biome lint + TypeScript (in parallel) → Vitest, so teammates get the same gate locally that CI enforces without remembering bespoke commands.

## Coding Style & Naming Conventions
We target Node 22+, native ES modules, strict TypeScript, and 2-space indentation. Use descriptive PascalCase components (`HandsDetector`), camelCase utilities, and kebab-case CSS class names. Biome stays authoritative for lint/format—run it before committing. Comments stick to the narrative why/what/how flow so future readers understand intent and expected behavior.

## Testing Guidelines
Treat tests as layered guardrails: fast Vitest unit specs live beside their modules with a `.test.ts` suffix, integration checks exercise MediaPipe wiring plus audio or camera mocks, and manual smoke tests confirm the demo HTML entrypoints. Wherever we stub browsers or hardware, describe the contract we expect (e.g., landmark payload shape, canvas dimensions) so future contributors can extend coverage without reverse-engineering intent. Keep targeting ~80% line coverage, and explain any purposeful gaps plus follow-up actions in the PR description.

## Commit & Pull Request Guidelines
- Stick to the `type: summary` subject pattern (e.g., `build: add three-channel Vite entry`) and keep bodies focused on intent plus any issue links.
- Add a short “Verification” note in each PR or commit message describing what you ran or observed (commands, screenshots, audio captures) so reviewers know how you tested.
- Lefthook already runs Biome fix, Biome lint, TypeScript, and Vitest before every commit; invoke `pnpm lint`, `pnpm test`, or `pnpm build` manually only when you want extra signal between commits.
- Reference the relevant doc or ADR whenever architecture shifts, and call out how you validated parity with the legacy HTML demos when they’re touched.

## Task Planning & ADR Alignment
When starting any task, first capture a short checklist-style plan (three to five steps is ideal) so reviewers can track progress as we tick off items. Reference the ADRs under `docs/` and ensure new code follows their prescribed patterns; call out the ADR you followed (or updated) in the PR description. Keep using the asset-loader helpers in `src/vision/hands.ts`, stick to `pnpm@10.20.0`, and document new permission or configuration needs alongside the plan so downstream reviewers know what to validate.

## README Voice & Maintenance
Use README updates to welcome first-time contributors and explain the workflow in plain language. When editing that file:
- Lead every section with the purpose (“why”) before listing steps or commands, and keep the tone collaborative (“we” / “our” / “teammates”).
- Spell out what runs automatically (e.g., Lefthook’s Biome → TypeScript → Vitest chain) versus what contributors run manually, so newcomers immediately understand expectations.
- Note important dates only when they add context, and remove stale markers as soon as they no longer help (e.g., temporary deployment notes).
- Prefer short paragraphs over long bullet walls so the story flows: introduce the idea, describe the command, then highlight the outcome/side effect we should expect.
- When new tooling or conventions appear, explain how to trigger them (`pnpm lint`, `pnpm commit`, etc.) and why they exist, mirroring the style used in the current “Getting Started” block.
