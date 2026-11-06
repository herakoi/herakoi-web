import type { Plugin } from "vite";

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

export const mediaPipeEsmExports = (): Plugin => ({
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

/** Served as-is in dev (not pre-bundled), so mediaPipeEsmExports applies there too. */
export const mediaPipePackages = ["@mediapipe/hands", "@mediapipe/drawing_utils"];
