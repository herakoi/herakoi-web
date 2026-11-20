import { defineMessages } from "#src/core/i18n";
import { createTranslation } from "#src/shared/i18n";
import { layersSamplingPluginId } from "./config";

export const messages = defineMessages({
  en: {
    displayName: "Layers & FITS",
    "layers.title": "Image layers",
    "layers.mode": "Colour mapping",
    "layers.mode.rgb": "RGB",
    "layers.mode.hsv": "HSV",
    "layers.channel.r": "Red",
    "layers.channel.g": "Green",
    "layers.channel.b": "Blue",
    "layers.channel.h": "Hue",
    "layers.channel.s": "Saturation",
    "layers.channel.v": "Value",
    "layers.channelLayer": "Layer for {{channel}}",
    "layers.none": "None",
    "layers.stretch": "Stretch",
    "layers.stretch.linear": "Linear",
    "layers.stretch.sqrt": "Square root",
    "layers.stretch.log": "Logarithmic",
    "layers.stretch.asinh": "Asinh",
    "layers.hint":
      "Every layer is also sent to the sound as its own channel. Choose what drives pitch, volume and effect in the Channel Oscillator settings.",
    "errors.FitsParseError": "Failed to read FITS file.",
    "errors.FitsStorageError": "Failed to store the FITS file in this browser.",
    "errors.LayerRenderError": "Failed to render the image layers.",
  },
  it: {
    displayName: "Livelli e FITS",
    "layers.title": "Livelli dell'immagine",
    "layers.mode": "Mappatura colori",
    "layers.mode.rgb": "RGB",
    "layers.mode.hsv": "HSV",
    "layers.channel.r": "Rosso",
    "layers.channel.g": "Verde",
    "layers.channel.b": "Blu",
    "layers.channel.h": "Tinta",
    "layers.channel.s": "Saturazione",
    "layers.channel.v": "Luminosità",
    "layers.channelLayer": "Livello per {{channel}}",
    "layers.none": "Nessuno",
    "layers.stretch": "Scala",
    "layers.stretch.linear": "Lineare",
    "layers.stretch.sqrt": "Radice quadrata",
    "layers.stretch.log": "Logaritmica",
    "layers.stretch.asinh": "Asinh",
    "layers.hint":
      "Ogni livello arriva anche al suono come canale a sé. Scegli cosa guida altezza, volume ed effetto nelle impostazioni dell'Oscillatore a canali.",
    "errors.FitsParseError": "Impossibile leggere il file FITS.",
    "errors.FitsStorageError": "Impossibile salvare il file FITS in questo browser.",
    "errors.LayerRenderError": "Impossibile disegnare i livelli dell'immagine.",
  },
});

export const { t, useT } = createTranslation(layersSamplingPluginId, messages);
