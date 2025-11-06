# Repository Guidelines

## Project Structure & Module Organization
Active development lives in `src/`, which Vite serves as our modern entry point. Legacy experiences now sit under `legacy_html/` (e.g., `legacy_html/herakoi_web_test/herakoi.html` and `legacy_html/herakoi_web_three_channels/html/index.html`) so we can compare behaviours without mixing concerns. Shared assets remain in `public/`, while documentation and decisions live in `docs/`—see `docs/pr1-bis-plan.md` for the phased refactor and `docs/adrs/` for architectural records. Keep every legacy subfolder intact when we relocate files; future tests still rely on that structure. Use the `#src/*` package import map whenever an import crosses directories, and reserve short relative paths for siblings or deeper descendants.

## Build, Test, and Development Commands
Install dependencies with `pnpm install` (Node ≥ 22). Run the local dev server using `pnpm dev`, which the devcontainer also launches via `postAttachCommand`; pass `--host 0.0.0.0` when Codespaces needs an external URL. Produce optimized assets with `pnpm build`, preview them through `pnpm preview`, and lint plus type-check with `pnpm lint` (this wraps Biome and both TypeScript projects). Execute unit tests using `pnpm test`. The historical Docker Compose stacks still live under `legacy_html` for verification runs—spin them up only when you need parity checks.

## Coding Style & Naming Conventions
We write TypeScript and modular CSS, indented with two spaces. Biome (`biome.jsonc`) enforces formatting, double quotes for JavaScript, and import organization; VS Code is preconfigured to apply those rules and organize imports on save. Stick to lowercase hyphenated filenames for new assets. When documenting code, follow the narrative commenting style (why → what → how) and cite the matching legacy lines in `legacy_html` so teammates can trace the migration path.

## Testing Guidelines
Follow the red → review → green flow: land Vitest specs first (colocated `*.test.ts` files with descriptive comments), pause for review, then implement. `pnpm lint` already runs Biome plus TypeScript type checking; keep both green before you request feedback. Manual verification still matters—after refactors, compare the Vite build against the legacy HTML to ensure MediaPipe hands rendering, audio sonification, and UI controls behave the same. Capture any gaps or risky scenarios in the plan or ADRs.

## Commit & Pull Request Guidelines
Commit messages stay short, imperative, and scoped (`tooling: introduce #src import alias`). Each PR should summarize the change, list `pnpm` commands you ran, and include screenshots or notes when UI behaviour differs. Call out TODOs or follow-ups openly and link to the relevant ADR or plan section so reviewers can trace context.

## Agent-Specific Instructions
Work on branch `repository-tooling` unless told otherwise. Preserve the legacy build pipeline while layering modern tooling; never delete historic assets without archival confirmation. Before substantial edits, update the plan or ADRs so reviewers can confirm intent. Keep comments welcoming (“we”, “our”) and highlight risks alongside mitigations. When unsure, ask—our goal is shared clarity as we modernize the stack.
