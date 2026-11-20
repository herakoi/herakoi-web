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
    "playMode.label": "Play notes",
    "playMode.motion": "As the hand moves (faster = more notes)",
    "playMode.change": "Whenever the note changes",
    "minRate.label": "While moving, at least {{rate}} notes per second",
    "minRate.aria": "Notes per second while moving slowly",
    "motionStep.label": "Plus one note every {{percent}}% of the screen height travelled",
    "motionStep.aria": "Extra note per distance travelled",
    "maxRate.label": "At most {{rate}} notes per second",
    "maxRate.aria": "Maximum notes per second",
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
    "playMode.label": "Suona le note",
    "playMode.motion": "Mentre la mano si muove (più veloce = più note)",
    "playMode.change": "Ogni volta che cambia la nota",
    "minRate.label": "Mentre la mano si muove, almeno {{rate}} note al secondo",
    "minRate.aria": "Note al secondo con movimenti lenti",
    "motionStep.label": "Più una nota ogni {{percent}}% dell'altezza dello schermo percorso",
    "motionStep.aria": "Nota in più per distanza percorsa",
    "maxRate.label": "Al massimo {{rate}} note al secondo",
    "maxRate.aria": "Numero massimo di note al secondo",
  },
});

export const { t, useT } = createTranslation(pianoSamplerPluginId, messages);
