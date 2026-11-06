import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: "unit",
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["src/**/*.browser.{test,spec}.{ts,tsx}", "node_modules"],
          pool: "threads",
          // Node 26 ships its own localStorage, undefined without --localstorage-file,
          // which hides happy-dom's. Turning it off lets tests use happy-dom's storage.
          execArgv: ["--no-experimental-webstorage"],
        },
      },
      {
        // Browser tests check computed styles, so Tailwind must process the CSS.
        plugins: [tailwindcss(), react()],
        test: {
          name: "browser",
          include: ["src/**/*.browser.{test,spec}.{ts,tsx}"],
          setupFiles: ["src/test-setup.browser.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            headless: true,
          },
        },
      },
    ],
  },
});
