# ADR 008: Accessibility Linting with Biome

## Status
Accepted – 6 November 2026. Supersedes ADR 005.

## Context
Biome is the project's linter and formatter. Accessibility rules for JSX come from Biome's `a11y` rule group, which in Biome 2.6 covers every rule of the `eslint-plugin-jsx-a11y` recommended configuration with a stable rule (`biome migrate eslint` maps 33 of the 34; `control-has-associated-label`, off in that configuration, exists only as a nursery rule).

A single linter also removes the TypeScript parser that ESLint needed for `.tsx` files (`typescript-eslint`), which supports TypeScript only up to 6.0.

## Decision
- Biome's `a11y` group lints accessibility. Its recommended rules are on, plus `noNoninteractiveElementInteractions`, the one jsx-a11y recommended rule that Biome leaves off by default.
- `pnpm lint` runs `biome check` and the TypeScript check. CI runs `pnpm lint:biome`, so accessibility rules are enforced in CI.
- Intentional exceptions use `biome-ignore lint/a11y/<rule>: <reason>` next to the element.

## Consequences
- One linter configuration (`biome.jsonc`) and no ESLint dependencies.
- Biome's rules are stricter in places: `noNoninteractiveElementInteractions` considers every event handler (jsx-a11y checks a fixed list), and `useFocusableInteractive` and `useSemanticElements` flag patterns jsx-a11y's recommended set lets through.
- Automated checks still cannot judge focus order, label quality or keyboard flows; `docs/accessibility.md` describes the manual checks.

## References
- Biome a11y rules: https://biomejs.dev/linter/javascript/rules/#a11y
- Rule sources (jsx-a11y equivalents): https://biomejs.dev/linter/javascript/sources/
