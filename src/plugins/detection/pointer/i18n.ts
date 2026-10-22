import { defineMessages } from "#src/core/i18n";
import { createTranslation } from "#src/shared/i18n";
import { pointerDetectionPluginId } from "./config";

export const messages = defineMessages({
  en: {
    displayName: "Mouse / Touch",
    "errors.PointerOverlayNotMountedError": "Pointer detection overlay canvas is not mounted.",
  },
  it: {
    displayName: "Mouse / tocco",
    "errors.PointerOverlayNotMountedError":
      "Il livello per il rilevamento del puntatore non è montato.",
  },
});

export const { t, useT } = createTranslation(pointerDetectionPluginId, messages);
