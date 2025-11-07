import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import { defineConfig } from "vite";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base = repoName ? `/${repoName}/` : "/";

function copyLegacyHtmlPlugin(): Plugin {
  let outDir = "dist";
  return {
    name: "copy-legacy-html",
    apply: "build" as const,
    configResolved(config: ResolvedConfig) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const legacySource = resolve(__dirname, "legacy_html");
      if (!existsSync(legacySource)) {
        return;
      }

      const resolvedOutDir = resolve(__dirname, outDir);
      mkdirSync(resolvedOutDir, { recursive: true });
      const legacyDestination = resolve(resolvedOutDir, "legacy_html");
      rmSync(legacyDestination, { recursive: true, force: true });
      cpSync(legacySource, legacyDestination, { recursive: true });
    },
  };
}

export default defineConfig({
  base,
  plugins: [copyLegacyHtmlPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        oneChannel: resolve(__dirname, "one-channel.html"),
        threeChannel: resolve(__dirname, "three-channel.html"),
      },
    },
  },
});
