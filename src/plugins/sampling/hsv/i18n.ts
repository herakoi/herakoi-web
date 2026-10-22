import { useCallback } from "react";
import { defineMessages } from "#src/core/i18n";
import { createTranslation } from "#src/shared/i18n";
import { hsvSamplingPluginId } from "./config";
import { curatedMetaPrefix } from "./data/curatedImages";
import type { ImageEntry } from "./types/image";

export const messages = defineMessages({
  en: {
    displayName: "HSV Color",
    "toolbar.importImage": "Import image",
    "toolbar.selectImage": "Select image: {{title}}",
    "toolbar.moveImage": "Move image",
    "toolbar.moveImageInstructions":
      "Desktop: drag to pan, wheel to zoom, Shift+wheel to rotate. Mobile: drag with one finger, pinch to zoom/rotate.",
    "toolbar.moveImageUnavailable": "Available when the image fills the screen (cover mode).",
    "toolbar.zoomButton": "Zoom: {{zoom}}x",
    "toolbar.zoom": "Zoom",
    "toolbar.zoomLevel": "Zoom level",
    "toolbar.rotation": "Rotation",
    "toolbar.rotationAngle": "Rotation angle",
    "toolbar.noUploads": "No cached uploads yet.",
    "toolbar.removeUpload": "Remove {{title}}",
    "upload.dropHere": "Drop image here",
    "upload.orBrowse": "or click to browse",
    "upload.dropOrBrowse": "Upload image: drop here or click to browse",
    "upload.chooseFile": "Choose image file",
    "settings.activeImage": "Active image",
    "settings.enablePan": "Enable pan gesture",
    "image.fallbackTitle": "Curated image",
    "image.curated": "Curated",
    "image.how-gamma-test.title": "Gamma color test",
    "image.how-gamma-test.meta": "HSV sweep - SVG",
    "errors.ImageReadError": "Failed to read image file.",
    "errors.ImageDecodeError": "Failed to decode uploaded image.",
    "errors.ImageSelectError": "Failed to select image.",
    "errors.UploadCacheReadError": "Failed to parse upload cache.",
    "errors.UploadCacheWriteError": "Failed to persist upload cache.",
  },
  it: {
    displayName: "Colore HSV",
    "toolbar.importImage": "Importa immagine",
    "toolbar.selectImage": "Scegli immagine: {{title}}",
    "toolbar.moveImage": "Sposta immagine",
    "toolbar.moveImageInstructions":
      "Desktop: trascina per spostare, rotella per lo zoom, Maiusc+rotella per ruotare. Mobile: trascina con un dito, pizzica per zoom e rotazione.",
    "toolbar.moveImageUnavailable":
      "Disponibile quando l'immagine riempie lo schermo (modalità copertura).",
    "toolbar.zoomButton": "Zoom: {{zoom}}x",
    "toolbar.zoom": "Zoom",
    "toolbar.zoomLevel": "Livello di zoom",
    "toolbar.rotation": "Rotazione",
    "toolbar.rotationAngle": "Angolo di rotazione",
    "toolbar.noUploads": "Nessuna immagine caricata finora.",
    "toolbar.removeUpload": "Rimuovi {{title}}",
    "upload.dropHere": "Trascina qui un'immagine",
    "upload.orBrowse": "o fai clic per sfogliare",
    "upload.dropOrBrowse": "Carica immagine: trascinala qui o fai clic per sfogliare",
    "upload.chooseFile": "Scegli un file immagine",
    "settings.activeImage": "Immagine attiva",
    "settings.enablePan": "Abilita il gesto di spostamento",
    "image.fallbackTitle": "Immagine selezionata",
    "image.curated": "Selezione",
    "image.how-gamma-test.title": "Test di colore gamma",
    "image.how-gamma-test.meta": "Sfumatura HSV - SVG",
    "errors.ImageReadError": "Impossibile leggere il file immagine.",
    "errors.ImageDecodeError": "Impossibile decodificare l'immagine caricata.",
    "errors.ImageSelectError": "Impossibile selezionare l'immagine.",
    "errors.UploadCacheReadError": "Impossibile leggere le immagini caricate in precedenza.",
    "errors.UploadCacheWriteError": "Impossibile salvare le immagini caricate.",
  },
});

export const { t, useT } = createTranslation(hsvSamplingPluginId, messages);

type MessageKey = keyof (typeof messages)["en"];

const isMessageKey = (key: string): key is MessageKey => key in messages.en;

/**
 * An image entry with its UI texts in the current language. Built-in "how it works" images
 * have translated titles; curated images keep their proper titles and translate the "Curated"
 * label; uploads keep the file name.
 */
export const useLocalizeImageEntry = () => {
  const translate = useT();
  return useCallback(
    <TEntry extends Pick<ImageEntry, "id" | "kind" | "title" | "meta">>(entry: TEntry): TEntry => {
      if (entry.kind === "how") {
        const titleKey = `image.${entry.id}.title`;
        const metaKey = `image.${entry.id}.meta`;
        return {
          ...entry,
          title: isMessageKey(titleKey) ? translate(titleKey) : entry.title,
          meta: isMessageKey(metaKey) ? translate(metaKey) : entry.meta,
        };
      }
      if (entry.kind === "curated" && entry.meta.startsWith(curatedMetaPrefix)) {
        return {
          ...entry,
          meta: `${translate("image.curated")}${entry.meta.slice(curatedMetaPrefix.length)}`,
        };
      }
      return entry;
    },
    [translate],
  );
};
