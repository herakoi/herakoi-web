import { defineMessages } from "#src/core/i18n";
import { createTranslation } from "#src/shared/i18n";
import { pianoSamplerPluginId } from "./config";

export const messages = defineMessages({
  en: {
    displayName: "Piano Sampler",
    "noteRange.label": "MIDI note range ({{min}} – {{max}})",
    "noteRange.aria": "MIDI note range",
    "noteRange.min": "Minimum note",
    "noteRange.max": "Maximum note",
    "velocityRange.label": "Velocity range ({{min}} – {{max}})",
    "velocityRange.aria": "Velocity range",
    "velocityRange.min": "Minimum velocity",
    "velocityRange.max": "Maximum velocity",
    "noteDuration.label": "Note duration",
    "noteDuration.placeholder": "Duration",
  },
  it: {
    displayName: "Pianoforte campionato",
    "noteRange.label": "Intervallo di note MIDI ({{min}} – {{max}})",
    "noteRange.aria": "Intervallo di note MIDI",
    "noteRange.min": "Nota minima",
    "noteRange.max": "Nota massima",
    "velocityRange.label": "Intervallo di dinamica ({{min}} – {{max}})",
    "velocityRange.aria": "Intervallo di dinamica",
    "velocityRange.min": "Dinamica minima",
    "velocityRange.max": "Dinamica massima",
    "noteDuration.label": "Durata della nota",
    "noteDuration.placeholder": "Durata",
  },
});

export const { t, useT } = createTranslation(pianoSamplerPluginId, messages);
