# Modern Tooling Roadmap

## Objectives
We want to introduce a maintainable frontend toolchain (TypeScript, Vite, Biome, PostCSS) without altering the current user experience. Our north star for today is to stand up the tooling scaffolding, keep the existing HTML demo verifiable, and equip the team with a reproducible developer environment via Dev Containers and Codespaces.

## Baseline & Risk Controls
- Relocate the legacy entry points into `legacy_html/` while keeping their internal layouts intact (e.g., `legacy_html/herakoi_web_three_channels/html`, `legacy_html/herakoi_web_test/herakoi.html`, `legacy_html/test_imgs`, `legacy_html/README.md`). This lets us reference behaviours without editing the historic files.
- Treat everything inside `legacy_html/` as read-only reference material. New UI work will land inside modular TypeScript views under `src/`, even when we are chasing feature parity. We compare outputs but never copy/paste entire legacy blocks forward.

## Tooling Workstream
1. **TypeScript adoption**  
   - Introduce a `/src` workspace with Vite’s vanilla-ts template, then rebuild UI controllers as small modules that consume the same data/DOM contract the legacy demos expose. We reference the legacy scripts for behaviour, not for copy/paste ports.  
   - Configure strict TypeScript settings but temporarily allow `any` so we unblock MediaPipe prototype code. Track follow-up tasks to tighten types as modules stabilize.
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
2. **One-channel parity build**  
   - Copy the markup from `legacy_html/herakoi_web_test/herakoi.html` into a new Vite entry (`one-channel.html`), but split the inline `<script>` and `<style>` into TypeScript and CSS modules under `src/oneChannel/`. This keeps behaviour identical while letting the tooling own bundling.  
   - Run the manual smoke checklist against both the Vite entry and the raw legacy file to ensure behaviour stays aligned.
3. **Three-channel parity build**  
   - Repeat the approach for `legacy_html/herakoi_web_three_channels/html/index.html`: duplicate the HTML shell for Vite while extracting JS/CSS into dedicated modules (e.g., `src/threeChannels/`).  
   - Leave any deeper refactors (shared components, state stores) for later once both parity entries compile cleanly through Vite.

## Environment & Dev Experience
- Author a `.devcontainer/devcontainer.json` that installs Node.js 22 LTS, Biome, and Docker CLI tooling; mount the repo and configure post-create commands to run `pnpm install`.  
- Mirror the configuration in a `devcontainer.json` at the repo root for Codespaces users.  
- Provide workspace recommendations (VS Code extensions, Biome formatter integration) in the Dev Container features.
- Draft a top-level `README.md` that explains the modern toolchain, how legacy references fit in, and where to find the GitHub Pages preview once it exists.
- Reflect any new workflow expectations inside `AGENTS.md` so every agent sees the requirement to update this plan before acting.
