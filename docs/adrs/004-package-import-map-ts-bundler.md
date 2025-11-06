# ADR 004: Rely on Package Import Map for #src Alias (Not tsconfig Paths)

## Status
Accepted – 6 November 2025

## Context
ADR 003 introduced the `#src/*` alias via `package.json#imports` so we can reach across feature folders without fragile `../../..` hops. While wiring `src/oneChannel/main.ts` to reuse `src/vision/hands`, TypeScript failed to resolve `#src/vision/hands` even though Vite and the browser were happy. The temptation was to duplicate the alias inside `tsconfig.json` via `baseUrl`/`paths`, but that would:

- Reintroduce the dual-source-of-truth problem ADR 003 set out to avoid.
- Drift from Node’s native import-map resolution (which Vite already mirrors), forcing every tool to keep a bespoke copy of the same alias.

Investigation showed that TypeScript’s Bundler resolver reads `package.json#imports`, but it requires the mapped target to include an explicit extension. Our previous entry (`"./src/*"`) lacked one, so TypeScript stopped early. Updating the subpath pattern to `"./src/*.ts"` fixed the issue without touching `tsconfig.json`.

## Decision
- Keep `#src/*` declared only in `package.json#imports` and do **not** replicate it in `tsconfig.json`.
- Specify concrete extensions in each import-map target so the Bundler resolver can finish resolution. Today we only ship `.ts` modules, so our entry is:

```json
"imports": {
  "#src/*": "./src/*.ts"
}
```

- When we introduce additional source extensions (e.g., `.tsx`, `.jsx`, or `.js`), extend the import-map entry with ordered fallbacks rather than editing `tsconfig.json`. Example:

```json
"imports": {
  "#src/*": [
    "./src/*.ts",
    "./src/*.tsx",
    "./src/*.js",
    "./src/*.jsx"
  ]
}
```

This keeps the alias definition in one place and teaches TypeScript how to find upcoming file types.

## Consequences
- Tooling that understands Node import maps (Vite, pnpm, Vitest, modern Node) automatically inherits the alias—no redundant per-tool config.
- TypeScript remains aligned with the runtime by following the import map, avoiding subtle divergences between editor intellisense and actual builds.
- When new source extensions arrive, the workflow is “append a fallback target” instead of “edit multiple config files.” The ADR now documents that expectation, so we don’t regress to tsconfig paths later.
- Teams adding tooling that ignores `package.json#imports` must either teach that tool about import maps or document an exception here before introducing secondary alias definitions.
