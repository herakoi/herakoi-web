# ADR 001: Simplified TypeScript Configuration Layout

## Status
Accepted – 6 November 2025

## Context
When bootstrapping the modern toolchain we needed TypeScript settings for two distinct contexts:
- Browser code under `src/`, which depends on DOM types and Vite client definitions.
- Build tooling such as `vite.config.ts`, which runs in Node.js and should not pull DOM typings.

The official `create-vite` scaffolds model this with a solution `tsconfig.json` that references two subordinate configs (`tsconfig.app.json` and `tsconfig.node.json`). That structure is powerful, but it introduces extra indirection for a small project that currently has a single browser entry and one build script.

## Decision
We keep a simplified variant:
- `tsconfig.json` directly configures the browser code under `src/**`.
- `tsconfig.node.json` lives alongside `vite.config.ts` and scopes Node-specific compiler options to build-time files. It keeps `"module": "NodeNext"` / `"moduleResolution": "NodeNext"` so TypeScript mirrors the resolution behaviour that Node uses when executing Vite’s config. We will revisit this if those scripts ever run through a bundler pipeline instead of Node directly.

TypeScript and editor tooling naturally select the right config by walking up the directory tree, so no custom wiring is required. This layout keeps the setup approachable while still isolating DOM and Node typings.

## Consequences
- Developers can open or run `tsc` against client files without juggling project references.
- If we later introduce more Node-side scripts or multiple app targets, we may revisit the official multi-project structure for finer-grained control.
- Documentation of this choice prevents confusion for teammates comparing our repo with `create-vite` defaults.
