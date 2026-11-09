# ADR 010: Own Translation Module

## Status
Accepted – 9 November 2026.

## Context
The shell, the shared components and every plugin translate their texts through `src/shared/i18n`. Each namespace declares its messages with `defineMessages` (`src/core/i18n.ts`), which checks at compile time that every locale has the English keys.

The app needs a small part of a translation library: flat keys per namespace, `{{name}}` interpolation, a fallback to English and then to a default text, a lookup across several namespaces for error messages, and re-rendering when the language changes. It uses no plural forms, formatting, lazy-loaded languages or translation components.

## Decision
- `src/shared/i18n/index.ts` keeps the catalogs in memory, by locale and namespace, and interpolates `{{name}}` itself.
- The current locale lives in a small store; React components read it with `useSyncExternalStore`, so `useT`, `useLocale`, `usePluginName` and `useErrorText` re-render on a language change.
- A text is looked up namespace by namespace; within a namespace, a missing translation falls back to English. Without a match the caller's default text is used, or the key itself.
- A placeholder without a value stays as written.

## Consequences
- No translation library among the dependencies; the app's JavaScript is about 17 kB smaller once compressed.
- Features beyond these are written here when needed: plural forms with `Intl.PluralRules`, numbers and dates with `Intl.NumberFormat` and `Intl.DateTimeFormat`.
- `src/shared/i18n/index.test.tsx` describes the behavior the module guarantees.

## Discarded directions
- **i18next with react-i18next**: covers far more than the app uses, adds about 70 kB minified to the bundle and needs regular major upgrades.

## References
- Issue #84
- React `useSyncExternalStore`: https://react.dev/reference/react/useSyncExternalStore
