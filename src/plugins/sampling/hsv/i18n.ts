import { defineMessages } from "#src/core/i18n";
import { createTranslation } from "#src/shared/i18n";
import { hsvSamplingPluginId } from "./config";

export const messages = defineMessages({
  en: {
    displayName: "HSV Color",
  },
  it: {
    displayName: "Colore HSV",
  },
});

export const { t, useT } = createTranslation(hsvSamplingPluginId, messages);
