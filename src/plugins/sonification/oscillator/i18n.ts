import { defineMessages } from "#src/core/i18n";
import { createTranslation } from "#src/shared/i18n";
import { oscillatorSonificationPluginId } from "./config";

export const messages = defineMessages({
  en: {
    displayName: "Web Audio Oscillator",
    "frequencyRange.label": "Frequency range ({{min}}Hz – {{max}}Hz)",
    "frequencyRange.aria": "Frequency range",
    "frequencyRange.min": "Minimum frequency",
    "frequencyRange.max": "Maximum frequency",
    "volumeRange.label": "Volume range ({{min}}% – {{max}}%)",
    "volumeRange.aria": "Volume range",
    "volumeRange.min": "Minimum volume",
    "volumeRange.max": "Maximum volume",
    "waveform.label": "Waveform",
    "waveform.aria": "Oscillator waveform",
    "waveform.sine": "Sine",
    "waveform.triangle": "Triangle",
    "waveform.sawtooth": "Sawtooth",
    "waveform.square": "Square",
  },
  it: {
    displayName: "Oscillatore Web Audio",
    "frequencyRange.label": "Intervallo di frequenza ({{min}}Hz – {{max}}Hz)",
    "frequencyRange.aria": "Intervallo di frequenza",
    "frequencyRange.min": "Frequenza minima",
    "frequencyRange.max": "Frequenza massima",
    "volumeRange.label": "Intervallo di volume ({{min}}% – {{max}}%)",
    "volumeRange.aria": "Intervallo di volume",
    "volumeRange.min": "Volume minimo",
    "volumeRange.max": "Volume massimo",
    "waveform.label": "Forma d'onda",
    "waveform.aria": "Forma d'onda dell'oscillatore",
    "waveform.sine": "Sinusoidale",
    "waveform.triangle": "Triangolare",
    "waveform.sawtooth": "A dente di sega",
    "waveform.square": "Quadra",
  },
});

export const { t, useT } = createTranslation(oscillatorSonificationPluginId, messages);
