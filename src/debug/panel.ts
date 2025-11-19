export type DebugToneSample = {
  toneId: string;
  frequency: number;
  volume: number;
  hueByte: number;
  valueByte: number;
};

export type PanelLogger = {
  logSamples: (samples: DebugToneSample[]) => void;
};

export const createDebugPanel = (): PanelLogger => {
  const panel = ensurePanel();
  const toneSamples = new Map<string, DebugToneSample>();

  const render = () => {
    const lines = Array.from(toneSamples.values()).map((sample) => {
      const freq = `${sample.frequency.toFixed(1)} Hz`;
      const vol = sample.volume.toFixed(2);
      return `${sample.toneId}: ${freq} | vol ${vol} | hue ${sample.hueByte} | value ${sample.valueByte}`;
    });

    panel.textContent = lines.length > 0 ? lines.join("\n") : "No tone samples yet.";
  };

  return {
    logSamples: (samples) => {
      const seen = new Set<string>();
      for (const sample of samples) {
        toneSamples.set(sample.toneId, sample);
        seen.add(sample.toneId);
      }

      for (const toneId of toneSamples.keys()) {
        if (!seen.has(toneId)) {
          toneSamples.delete(toneId);
        }
      }

      render();
    },
  };
};

const ensurePanel = () => {
  const existing = document.getElementById("herakoi-debug-panel");
  if (existing) {
    return existing;
  }

  const panel = document.createElement("pre");
  panel.id = "herakoi-debug-panel";
  panel.style.position = "fixed";
  panel.style.bottom = "0";
  panel.style.right = "0";
  panel.style.maxWidth = "320px";
  panel.style.maxHeight = "200px";
  panel.style.overflow = "auto";
  panel.style.padding = "8px";
  panel.style.margin = "0";
  panel.style.background = "rgba(0, 0, 0, 0.7)";
  panel.style.color = "lime";
  panel.style.fontSize = "12px";
  panel.style.zIndex = "9999";
  panel.style.pointerEvents = "none";
  panel.textContent = "Debug panel ready.";

  document.body.append(panel);
  return panel;
};
