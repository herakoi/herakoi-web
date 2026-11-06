/**
 * ESLint configuration for accessibility linting only.
 *
 * This project primarily uses Biome for linting/formatting, but maintains
 * ESLint specifically for accessibility checks via eslint-plugin-jsx-a11y.
 * Biome's a11y rules are not yet mature enough to replace this tooling.
 *
 * See docs/adrs/005-dual-linting-biome-eslint-a11y.md for rationale.
 */
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist", "node_modules", "legacy_html"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "jsx-a11y": jsxA11y,
    },
    rules: {
      // Only enable a11y rules - Biome handles all other linting
      ...jsxA11y.configs.recommended.rules,
    },
  },
];
