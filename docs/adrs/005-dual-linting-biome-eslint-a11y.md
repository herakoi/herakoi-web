# ADR 005: Dual Linting Setup for Accessibility (Biome + ESLint)

## Status
Accepted – 6 February 2026

## Context
Herakoi uses Biome as its primary linter and formatter, handling general code quality checks, formatting, and most linting rules. On January 20, 2026, ESLint was added to the project specifically for accessibility (a11y) linting using `eslint-plugin-jsx-a11y`. This creates a deliberate dual linting setup where:

- **Biome** handles general linting (code quality, naming conventions, best practices) and all formatting
- **ESLint** handles accessibility-specific checks via the mature jsx-a11y plugin

While this might appear redundant, it's a necessary architectural decision because **Biome's accessibility rules are not yet mature enough** for production use. According to Biome's 2026 roadmap, the team "recently started implementing" a11y rules and explicitly acknowledges significant gaps:

- Missing implementation of 3 critical W3C specifications:
  - ARIA in HTML
  - HTML AAM 1.0 (Accessibility API Mappings)
  - Accessible Name and Description Computation 1.1
- 59+ open accessibility-related issues on GitHub
- Risk of incorrect advice: Biome can "interpret HTML elements differently than a browser does which can lead to bad advice"

In contrast, `eslint-plugin-jsx-a11y` is battle-tested, widely adopted, and essential for teams prioritizing accessible interfaces. It implements comprehensive WCAG compliance checks that Biome cannot yet match.

This decision follows industry guidance from BetterStack's Biome vs ESLint comparison guide, which explicitly recommends: "A hybrid setup can work well by combining Biome for formatting with ESLint for specialized rules."

## Decision
Maintain a dual linting setup where:

1. **Biome remains the primary linter/formatter**
   - Handles all code formatting via `pnpm format` and `pnpm lint:biome:fix`
   - Performs general linting checks (code quality, best practices, imports)
   - Runs via `pnpm lint:biome`

2. **ESLint handles accessibility linting exclusively**
   - Uses `eslint-plugin-jsx-a11y` with recommended rules
   - Runs via `pnpm lint:a11y`
   - Configuration scoped to a11y concerns only (see `eslint.config.js`)

3. **Combined workflow**
   - `pnpm lint` executes both linters plus TypeScript checks
   - Pre-commit hooks enforce both Biome and ESLint via Lefthook
   - Both tools must pass for CI/CD success

4. **Review timeline**
   - Revisit this decision in 6-12 months (Q3-Q4 2026)
   - Monitor Biome's accessibility roadmap progress
   - Consider consolidation once Biome implements complete W3C spec coverage and resolves open a11y issues

## Consequences

### Positive
- **Better accessibility coverage**: Production-grade a11y checks via the mature jsx-a11y plugin ensure WCAG compliance
- **Clear separation of concerns**: General linting (Biome) vs specialized a11y checks (ESLint) are architecturally distinct
- **Future-ready**: When Biome's a11y rules mature, we can consolidate by simply removing ESLint without changing Biome configuration
- **Industry-aligned**: Follows recommended practices for hybrid linting setups

### Negative
- **Slight tooling complexity**: Two linters to maintain instead of one
- **Additional dependencies**: ESLint, typescript-eslint, eslint-plugin-jsx-a11y, eslint-plugin-react, and globals packages
- **Potential rule overlap**: Future Biome a11y rules might duplicate ESLint checks (manageable by disabling Biome's a11y rules if/when they stabilize)

### Neutral
- Developers must understand which linter handles which concerns (documented in CLAUDE.md)
- CI/CD pipeline runs two linting tools sequentially (minimal performance impact)

## References
- BetterStack Biome vs ESLint guide: https://betterstack.com/community/guides/scaling-nodejs/biome-eslint/
- Biome 2026 roadmap (accessibility section): https://biomejs.dev/blog/roadmap-2026/
- Biome accessibility discussion (issue tracking): https://github.com/biomejs/biome/discussions/7128
- W3C ARIA in HTML specification: https://www.w3.org/TR/html-aria/
- eslint-plugin-jsx-a11y documentation: https://github.com/jsx-eslint/eslint-plugin-jsx-a11y
