# ADR 009: CSS Modules with Lightning CSS

## Status
Accepted – 6 November 2026.

## Context
The interface is stable and small: a few dozen components, one theme, no design churn. Utility classes spread its styling across long `className` strings that need `tailwind-merge` to resolve conflicts between a component's classes and the caller's, and states such as hover-on-parent or open popovers through framework variants. Reading or changing a component's look means reading those strings.

## Decision
- Each component has a `Component.module.css` next to it; `clsx` joins class names.
- Design tokens are CSS custom properties in `src/styles/tokens.css`. `src/styles/reset.css` is the base reset (Tailwind Preflight, MIT). `src/globals.css` imports both and adds a `base` layer: border color, body, button cursor, focus ring.
- Cascade layers are declared in `index.html` before any stylesheet loads: `reset, base, ui`. Shared ui components sit in `ui`; component modules stay outside layers, so they override all three.
- Box shadows compose through two non-inherited custom properties: `--elevation` (the element's own shadow) and `--focus-shadow` (set by `:focus-visible`).
- Vite compiles CSS with Lightning CSS (`css.transformer: "lightningcss"`), the CSS engine Vite is moving to; Vitest uses the same setting.

## Consequences
- No Tailwind, `tailwind-merge`, `class-variance-authority` or `cn` helper.
- Lightning CSS does not follow chains of `composes`: a class lists every class it composes.
- Lightning CSS rounds `calc()` written in declarations; ratios that must stay exact (line heights) live in custom properties, where it keeps `calc()` as written.
- An element that uses the `hidden` attribute and sets its own `display` needs a `[hidden]` rule in its module, since module rules override the reset.

## Discarded directions
- **Vite's default CSS Modules (postcss-modules):** its loader parses composed files without a file name and warns on every build.
- **`display: none !important` on `[hidden]` in the reset:** it works for every element at once, but hides the rule from the component that needs it; the explicit `[hidden]` rule keeps it in the module.

## References
- Lightning CSS CSS Modules: https://lightningcss.dev/css-modules.html
- Vite `css.transformer`: https://vite.dev/config/shared-options.html#css-transformer
- Issue #16
