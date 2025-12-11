import { setupConsoleSonifier } from "./consoleSonifier";
import { createDebugPanel, type DebugToneSample } from "./panel";

export type { DebugToneSample } from "./panel";

const isBuildTimeDev = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);
/*
 * We let teammates flip on the debug HUD in production by tacking `?dev` onto the URL, which mirrors the
 * local DEV flag without needing a bespoke build. If parsing fails we quietly fall back to the safer default.
 */
const queryParamEnablesDev = (() => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    return params.has("dev");
  } catch {
    return false;
  }
})();

export const isDev = isBuildTimeDev || queryParamEnablesDev;

export type DebugTools = {
  logToneSamples: (samples: DebugToneSample[]) => void;
};

const noopTools: DebugTools = {
  logToneSamples: () => {},
};

export const setupDebugTools = (): DebugTools => {
  if (!isDev || typeof window === "undefined" || typeof document === "undefined") {
    return noopTools;
  }

  const panel = createDebugPanel();
  setupConsoleSonifier();

  return {
    logToneSamples: (samples) => {
      if (samples.length === 0) {
        panel.logSamples([]);
        return;
      }

      panel.logSamples(samples);
    },
  };
};
