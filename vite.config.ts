import { execSync } from "node:child_process";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { type BuildVersion, parseGitDescribe } from "./src/lib/buildVersion.ts";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base = repoName ? `/${repoName}/` : "/";
const https = process.env.HTTPS === "1";

const git = (args: string) =>
  execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"] }).toString();

// The version comes from the latest `v*` tag; builds without tags show only the commit.
const buildVersion = ((): BuildVersion => {
  try {
    const described = parseGitDescribe(git('describe --tags --long --match "v*"'));
    if (described) return described;
  } catch {}
  try {
    return { version: "unreleased", commit: git("rev-parse --short HEAD").trim() };
  } catch {
    return { version: "unreleased", commit: "unknown" };
  }
})();

const themeColor = "#141110";

/**
 * The legacy MediaPipe solutions are Closure scripts that publish their API on
 * `this || self` instead of exporting it. Rolldown loads them as ES modules,
 * where `this` is undefined, so the API lands on `self`: re-export it from there.
 */
const mediaPipeGlobals: Record<string, string[]> = {
  "@mediapipe/hands/hands.js": ["Hands", "HAND_CONNECTIONS", "VERSION"],
  "@mediapipe/drawing_utils/drawing_utils.js": [
    "clamp",
    "drawConnectors",
    "drawLandmarks",
    "drawRectangle",
    "lerp",
  ],
};

const mediaPipeEsmExports = (): Plugin => ({
  name: "herakoi:mediapipe-esm-exports",
  enforce: "pre",
  transform(code, id) {
    // Dev ids carry a ?v= cache buster; asset imports (?url, ?raw) are left alone.
    const [path, query = ""] = id.split("?");
    if (/\b(url|raw)\b/.test(query)) return null;
    const file = Object.keys(mediaPipeGlobals).find((suffix) => path.endsWith(suffix));
    if (!file) return null;
    const exports = mediaPipeGlobals[file]
      .map((name) => `export const ${name} = self.${name};`)
      .join("\n");
    return { code: `${code}\n${exports}\n`, map: null, moduleSideEffects: true };
  },
});

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion.version),
    __APP_COMMIT__: JSON.stringify(buildVersion.commit),
  },
  plugins: [
    mediaPipeEsmExports(),
    tailwindcss(),
    react(),
    ...(https ? [basicSsl()] : []),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["favicon.ico", "favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Herakoi",
        short_name: "Herakoi",
        description: "Sonify images with your hands: hand tracking turns colors into sound.",
        theme_color: themeColor,
        background_color: themeColor,
        display: "standalone",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // A new worker takes over at once, so the page reloads on the latest version.
        // The plugin sets these only when it injects the registration itself.
        skipWaiting: true,
        clientsClaim: true,
        // The shell is precached on install; heavy assets are cached the first time they are used.
        globPatterns: ["**/*.{js,css,html,ico,svg,ttf}", "*.png"],
        runtimeCaching: [
          {
            // Hashed build assets never change, so the cached copy is always valid.
            urlPattern: ({ sameOrigin, url }) =>
              sameOrigin && /\/assets\/.+\.(wasm|tflite|data|png|jpe?g|webp)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "herakoi-assets",
              expiration: { maxEntries: 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === "https://tonejs.github.io" &&
              url.pathname.startsWith("/audio/salamander/"),
            handler: "CacheFirst",
            options: {
              cacheName: "herakoi-piano-samples",
              expiration: { maxEntries: 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    // Served as-is so mediaPipeEsmExports can add their exports in dev too.
    exclude: ["@mediapipe/hands", "@mediapipe/drawing_utils"],
  },
  server: {
    host: true,
  },
});
