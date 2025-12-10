export type DebugToneSample = {
  toneId: string;
  frequency: number;
  volume: number;
  hueByte: number;
  saturationByte: number;
  valueByte: number;
};

export type PanelLogger = {
  logSamples: (samples: DebugToneSample[]) => void;
};

/**
 * Convert HSV bytes (0-255) to RGB color string
 */
const hsvToRgb = (h: number, s: number, v: number): string => {
  // Normalize to 0-1 range
  const hNorm = (h / 255) * 360; // hue in degrees
  const sNorm = s / 255;
  const vNorm = v / 255;

  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((hNorm / 60) % 2) - 1));
  const m = vNorm - c;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hNorm >= 0 && hNorm < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (hNorm >= 60 && hNorm < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (hNorm >= 120 && hNorm < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (hNorm >= 180 && hNorm < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (hNorm >= 240 && hNorm < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (hNorm >= 300 && hNorm < 360) {
    r = c;
    g = 0;
    b = x;
  }

  const rByte = Math.round((r + m) * 255);
  const gByte = Math.round((g + m) * 255);
  const bByte = Math.round((b + m) * 255);

  return `rgb(${rByte}, ${gByte}, ${bByte})`;
};

export const createDebugPanel = (): PanelLogger => {
  const panel = ensurePanel();
  const toneSamples = new Map<string, DebugToneSample>();

  const render = () => {
    if (toneSamples.size === 0) {
      panel.innerHTML = "No tone samples yet.";
      return;
    }

    const lines = Array.from(toneSamples.values()).map((sample) => {
      const freq = `${sample.frequency.toFixed(1)} Hz`;
      const vol = sample.volume.toFixed(2);
      const hue = sample.hueByte.toString().padStart(3, " ");
      const sat = sample.saturationByte.toString().padStart(3, " ");
      const value = sample.valueByte.toString().padStart(3, " ");

      const color = hsvToRgb(sample.hueByte, sample.saturationByte, sample.valueByte);

      // Create a line with a colored square
      return `<div style="display: flex; align-items: center; margin-bottom: 4px;">
        <span style="display: inline-block; width: 16px; height: 16px; background: ${color}; border: 1px solid #333; margin-right: 8px;"></span>
        <span>${sample.toneId}: ${freq} | vol ${vol} | h ${hue} s ${sat} v ${value}</span>
      </div>`;
    });

    panel.innerHTML = lines.join("");
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
  if (existing instanceof HTMLPreElement) {
    applyPanelStyles(existing);
    return existing;
  }

  const panel = document.createElement("pre");
  panel.id = "herakoi-debug-panel";
  applyPanelStyles(panel);
  panel.textContent = "Debug panel ready.";

  document.body.append(panel);
  return panel;
};

/*
 * We restyle the HUD every time so teammates always get the same roomy, monospaced panel that avoids tiny text
 * and stray scrollbars. It sits off to the bottom-right with viewport-based sizing, leaving enough padding
 * for long sample lines while pointer events stay disabled to keep the camera UI clickable.
 */
const applyPanelStyles = (panel: HTMLPreElement) => {
  panel.style.position = "fixed";
  panel.style.bottom = "16px";
  panel.style.right = "16px";
  panel.style.width = "min(500px, 45vw)";
  panel.style.maxWidth = "min(500px, 45vw)";
  panel.style.maxHeight = "min(320px, 50vh)";
  panel.style.overflowY = "auto";
  panel.style.overflowX = "hidden";
  panel.style.padding = "12px 16px";
  panel.style.margin = "0";
  panel.style.background = "rgba(0, 0, 0, 0.75)";
  panel.style.color = "#32cd32";
  panel.style.fontFamily = "ui-monospace, SFMono-Regular, Consolas, Menlo, monospace";
  panel.style.fontSize = "12px";
  panel.style.lineHeight = "1.5";
  panel.style.whiteSpace = "normal";
  panel.style.wordBreak = "normal";
  panel.style.zIndex = "9999";
  panel.style.pointerEvents = "none";
};
