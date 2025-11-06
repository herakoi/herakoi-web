# ADR 003: Package Import Alias Strategy

## Status
Accepted – 6 November 2025

## Context
As we expand the codebase beyond a single entry point, deep relative paths (`../../vision/hands`) quickly become fragile. Node 22 lets us declare import maps in `package.json`, and we have already adopted `pnpm` with ECMAScript modules, so the runtime can honour those maps without extra tooling. We also decided to colocate tests with their implementation, which means some imports stay local while domain modules often need to reach across directories (for example, a controller reaching into `src/vision`).

## Decision
We define a top-level import alias in `package.json`:

```json
"imports": {
  "#src/*": "./src/*"
}
```

Our rule of thumb:
- When a file imports siblings or navigates deeper within the same directory, we keep relative paths so the relationship is obvious (e.g. `./hands.test.ts` or `./helpers/format.ts`).
- Whenever code needs to climb upward out of its directory, we switch to the `#src/…` alias instead of chaining `../..`. This keeps intent readable and resilient to future reorganisations.

TypeScript, Vite, and pnpm resolve `#src/*` natively because Node owns the import map. If we introduce tooling that does not consume `package.json#imports`, we will mirror the alias in that tool’s configuration.

## Consequences
- Code reviewers can tell at a glance when an import crosses a folder boundary versus staying local.
- Refactors that move directories avoid the risky search-and-replace of long relative prefixes.
- New contributors learn one consistent escape hatch—`#src/…`—and still see short relative imports in colocated tests.
- We must document additional aliases in this ADR series if new domains call for them, keeping the map small and deliberate.
