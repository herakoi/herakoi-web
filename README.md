# Herakoi Image Sonification

Herakoi is a **motion-sensing sonification experiment**: a webcam tracks your hands via machine learning, re-projects the landmarks onto a reference image, and converts the colour/brightness of the “touched” pixels into sound so you can *hear* visuals for artistic, educational, or accessibility purposes. This repository hosts the web implementation of that idea—keeping the original HTML experiments alongside a modern TypeScript + Vite build so we can iterate quickly while remaining faithful to the Python prototype described at [herakoi/herakoi](https://github.com/herakoi/herakoi).

- **Goal:** explore sonification of still images and live camera feeds using real-time hand detection and simple audio synthesis.

## Contribution Guide

_2025-11-08 note:_ verifying that README-only tweaks do not trigger deployments.

### Project Layout
- `src/` – active TypeScript modules
- `legacy_html/` – read-only originals kept for behaviour comparison. 
- `docs/` – roadmaps (`docs/improvement-plan-pr1.md`), ADRs, and design notes.
- `AGENTS.md` – collaboration guidelines (narrative comments, plan updates, confirmation process).
- `public/` static assets served as-is.


### Getting Started
```bash
pnpm install
pnpm dev          # launches Vite dev server
pnpm lint         # biome + tsc
pnpm typecheck    # explicit project + config checks
pnpm test         # vitest (full suite by default; hooks pass --changed)
```

Your first `pnpm install` now also runs `lefthook install` automatically so Git wires the shared pre-commit hook (which executes `pnpm lint`) before you start committing.
Biome and TypeScript checks are exposed as separate scripts under the hood, letting Lefthook run them in parallel while `pnpm lint` still chains them for manual runs; Vitest now waits on those hooks so fast lint feedback lands before the heavier test suite spins up.
Pre-commit now auto-runs Biome’s fix mode first; if it rewrites files, Git pauses the commit so we can review and restage. Vitest follows with `--changed`, which tells Vitest to only execute specs tied to uncommitted file changes. Run `pnpm run lint:biome:fix` directly whenever you want those rewrites without executing the full hook chain.
