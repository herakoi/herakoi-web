# Herakoi Image Sonification

Herakoi is a **motion-sensing sonification experiment**: a webcam tracks your hands via machine learning, re-projects the landmarks onto a reference image, and converts the colour/brightness of the “touched” pixels into sound so you can *hear* visuals for artistic, educational, or accessibility purposes. This repository hosts the web implementation of that idea—keeping the original HTML experiments alongside a modern TypeScript + Vite build so we can iterate quickly while remaining faithful to the Python prototype described at [herakoi/herakoi](https://github.com/herakoi/herakoi).

- **Goal:** explore sonification of still images and live camera feeds using real-time hand detection and simple audio synthesis.

## Contribution Guide

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
pnpm commit       # Commitizen prompt for conventional commits
```

Your first `pnpm install` now also runs `lefthook install` automatically so Git wires the shared pre-commit hook (which executes `pnpm lint`) before you start committing.
Git commits automatically trigger Lefthook, which chains the following steps so everyone gets the same gate:

1. Biome fix runs first; if it changes files the commit aborts so we can review and restage the edits.
2. Biome lint and both TypeScript configs execute in parallel, mirroring `pnpm lint`.
3. Vitest runs with `--changed` to cover only specs touched by current diffs, keeping the hook fast while still catching regressions.

When you need those checks outside the commit flow, run the individual scripts (`pnpm run lint:biome:fix`, `pnpm lint`, `pnpm typecheck`, `pnpm test`) just as you would expect. `pnpm commit` launches Commitizen’s guided prompt, and Commitlint validates the message at `commit-msg`, so even first-time contributors get a compliant subject/body without memorizing the format.
