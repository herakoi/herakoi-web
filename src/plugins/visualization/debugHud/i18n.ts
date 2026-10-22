import { defineMessages } from "#src/core/i18n";
import { createTranslation } from "#src/shared/i18n";
import { debugHudVisualizationPluginId } from "./config";

export const messages = defineMessages({
  en: {
    displayName: "Debug HUD",
    "section.detection": "Detection",
    "section.sampling": "Sampling",
    "section.sonification": "Sonification",
    handsDetected: "Hands detected: {{count}}",
    normalizedCoords: "Normalized coords (0-1):",
    noData: "No data yet. Start the engine and move your hand in front of the camera.",
  },
  it: {
    displayName: "HUD di debug",
    "section.detection": "Rilevamento",
    "section.sampling": "Campionamento",
    "section.sonification": "Sonificazione",
    handsDetected: "Mani rilevate: {{count}}",
    normalizedCoords: "Coordinate normalizzate (0-1):",
    noData: "Ancora nessun dato. Avvia il motore e muovi la mano davanti alla fotocamera.",
  },
});

export const { t, useT } = createTranslation(debugHudVisualizationPluginId, messages);
