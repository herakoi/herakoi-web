import { setupConsoleSonifier } from "./consoleSonifier";
import { createDebugPanel, type DebugToneSample } from "./panel";

export type { DebugToneSample } from "./panel";

const isDev = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

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
