# Modern Tooling Roadmap

## Objectives
We want to introduce a maintainable frontend toolchain (TypeScript, Vite, Biome, PostCSS) without altering the current user experience. Our north star for today is to stand up the tooling scaffolding, keep the existing HTML demo verifiable, and equip the team with a reproducible developer environment via Dev Containers and Codespaces.

## Baseline & Risk Controls
- Relocate the legacy entry points into `legacy_html/` while keeping their internal layouts intact (e.g., `legacy_html/herakoi_web_three_channels/html`, `legacy_html/herakoi_web_test/herakoi.html`, `legacy_html/test_imgs`, `legacy_html/README.md`). This lets us serve them via Vite or Live Preview without losing historical structure.
- Define a manual smoke checklist covering image upload, webcam feed, and slider updates; we will run it before and after each major change.
- Capture written notes on any regressions we spot during manual testing so we can translate them into automated coverage later.

## Tooling Workstream
1. **TypeScript adoption**  
   - Introduce a `/src` workspace with Vite’s vanilla-ts template, then incrementally port the inline script from `index.html`.  
   - Configure strict TypeScript settings but temporarily allow `any` so we unblock MediaPipe prototype code. Track follow-up tasks to tighten types.
2. **Vite build pipeline**  
   - Scaffold Vite in the repo root, mapping `public/assets` for static files.  
   - Adopt `pnpm` for dependency management so we share lockfiles across platforms and benefit from the content-addressable store.  
   - Create parity entry points (`main.ts`, `style.css`) that replicate the current UI while using Vite’s dev server for HMR.
3. **Biome formatting & linting**  
   - Add a project-level `biome.json` mirroring two-space indentation and the narrative comment style from `AGENTS.md`.  
   - Wire Biome into `package.json` scripts (`lint`, `format`) and into the pre-commit hook queue once adopted.
4. **PostCSS pipeline**  
   - Configure PostCSS with autoprefixer and nesting support to simplify responsive tweaks.  
   - Document how legacy CSS lives within the new pipeline, and schedule the migration of inline styles into modular files.
5. **Testing suggestions**  
   - Add Vitest for unit coverage of helper utilities as they emerge.  
   - Keep Playwright on the radar for later regression testing once the TypeScript refactor settles.

## Migration Phases
1. **Tooling bootstrap**  
   - Stand up Vite + TypeScript with pnpm and PostCSS, serving a simple “Hello, Herakoi” page as the default entry (`index.html`) to validate the pipeline.  
   - Wire Biome lint/format scripts and document the new commands.
2. **Legacy test port**  
   - Configure a second Vite HTML entry (e.g., `test.html`) that mirrors `legacy_html/herakoi_web_test/herakoi.html`, reusing assets directly from the legacy directory.  
   - Validate manual smoke checks against this entry before proceeding.
3. **Three-channel app port**  
   - Add a third Vite entry (e.g., `three-channels.html`) that reproduces `legacy_html/herakoi_web_three_channels/html/index.html` with identical behavior.  
   - Retire direct edits to the legacy folder once parity is confirmed, leaving it for regression comparison only.

## Environment & Dev Experience
- Author a `.devcontainer/devcontainer.json` that installs Node.js 22 LTS, Biome, and Docker CLI tooling; mount the repo and configure post-create commands to run `pnpm install`.  
- Mirror the configuration in a `devcontainer.json` at the repo root for Codespaces users.  
- Provide workspace recommendations (VS Code extensions, Biome formatter integration) in the Dev Container features.

## Delivery Strategy
- Ship the modernization as a single, well-structured pull request so reviewers can follow the end-to-end toolchain upgrade in one place.
- Keep commit boundaries tight (e.g., legacy verification doc, tooling scaffold, devcontainer) to simplify review and bisecting if issues appear.
- Close with updated documentation and manual test notes before requesting approval.
