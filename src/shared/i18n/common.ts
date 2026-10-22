import { defineMessages } from "#src/core/i18n";
import { createTranslation } from "./index";

/** Texts of the shared components that the shell and plugins both render. */
const messages = defineMessages({
  en: {
    "audioOutput.label": "Audio output",
    "audioOutput.device": "Audio output device",
    "audioOutput.placeholder": "Select output device",
    "audioOutput.open": "Select audio output device",
    "audioOutput.fallbackName": "Audio output {{number}}",
    "audioOutput.systemDefault": "System default",
    "volume.controls": "Volume controls",
    "volume.panel": "Sonification audio controls",
    "volume.master": "Master volume",
    "volume.mute": "Mute sonification",
    "notification.dismiss": "Dismiss notification",
  },
  it: {
    "audioOutput.label": "Uscita audio",
    "audioOutput.device": "Dispositivo di uscita audio",
    "audioOutput.placeholder": "Scegli il dispositivo di uscita",
    "audioOutput.open": "Scegli il dispositivo di uscita audio",
    "audioOutput.fallbackName": "Uscita audio {{number}}",
    "audioOutput.systemDefault": "Predefinita di sistema",
    "volume.controls": "Controlli del volume",
    "volume.panel": "Controlli audio della sonificazione",
    "volume.master": "Volume generale",
    "volume.mute": "Silenzia la sonificazione",
    "notification.dismiss": "Chiudi la notifica",
  },
});

export const { t: commonT, useT: useCommonT } = createTranslation("common", messages);
