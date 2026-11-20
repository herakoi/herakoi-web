import { defineMessages } from "#src/core/i18n";
import { createTranslation, useErrorText as useNamespaceErrorText } from "#src/shared/i18n";
import { wallDetectionPluginId } from "./config";

export const messages = defineMessages({
  en: {
    displayName: "Wall / Screen",
    "settings.hand": "Playing hand",
    "settings.hand.right": "Right hand",
    "settings.hand.left": "Left hand",
    "settings.hand.both": "Both hands",
    "settings.playWith": "Play with",
    "settings.playWith.palm": "Palm (whole hand, steadier)",
    "settings.playWith.fingertip": "Index fingertip (precise)",
    "settings.people": "Tracked people ({{people}})",
    "settings.peopleLabel": "Tracked people",
    "settings.camera": "Camera",
    "settings.cameraDefault": "Default camera",
    "settings.preview": "Show camera preview",
    "map.start": "Map screen",
    "map.again": "Map again",
    "map.clear": "Forget mapping",
    "map.none":
      "Not mapped yet. Point the camera at this screen, step out of view and press Map screen.",
    "map.summary": "Mapped: {{matched}}/{{total}} dots, error {{error}} px",
    "map.summaryCoarse": "Mapped from the screen outline only (dots not found).",
    "map.notRunning": "Start the engine to map the screen.",
    "progress.black": "Mapping the screen (1/4)…",
    "progress.white": "Mapping the screen (2/4)…",
    "progress.dots": "Mapping the screen (3/4)…",
    "progress.coding": "Mapping the screen (4/4)…",
    "progress.solving": "Computing the mapping…",
    "notification.unmapped": "Map the screen first: open the camera panel and press Map screen",
    "notification.mapping": "Mapping the screen: stay out of the camera view",
    "notification.done": "Screen mapped",
    "notification.prompt": "Raise your hand in front of the screen to play",
    "notification.layoutChanged":
      "The window changed size since the screen was mapped: go full screen again or map again",
    "notification.failed": "Mapping failed: {{reason}}",
    "preview.title": "Camera",
    "preview.hide": "Hide camera preview",
    "preview.move": "Move camera preview",
    "preview.resize": "Resize camera preview",
    "errors.WallCameraStartError": "Camera start failed.",
    "errors.WallModelLoadError": "The tracking models could not be loaded.",
    "errors.WallNotRunningError": "Start the camera before mapping the screen.",
    "errors.ScreenNotFoundError":
      "The screen was not found. Point the camera at it and make sure it is fully visible.",
    "errors.MappingAbortedError": "Mapping was cancelled.",
    "errors.MappingUnreliableError":
      "Too few dots were found: make sure nobody stands between the camera and the screen, then map again. The previous mapping is kept.",
    "countdown.stepAway": "Mapping the screen: step out of the camera view",
  },
  it: {
    displayName: "Parete / schermo",
    "settings.hand": "Mano che suona",
    "settings.hand.right": "Mano destra",
    "settings.hand.left": "Mano sinistra",
    "settings.hand.both": "Entrambe le mani",
    "settings.playWith": "Suona con",
    "settings.playWith.palm": "Palmo (mano intera, più stabile)",
    "settings.playWith.fingertip": "Punta dell'indice (precisa)",
    "settings.people": "Persone tracciate ({{people}})",
    "settings.peopleLabel": "Persone tracciate",
    "settings.camera": "Fotocamera",
    "settings.cameraDefault": "Fotocamera predefinita",
    "settings.preview": "Mostra anteprima fotocamera",
    "map.start": "Mappa schermo",
    "map.again": "Mappa di nuovo",
    "map.clear": "Dimentica mappatura",
    "map.none":
      "Schermo non ancora mappato. Punta la fotocamera su questo schermo, esci dall'inquadratura e premi Mappa schermo.",
    "map.summary": "Mappato: {{matched}}/{{total}} punti, errore {{error}} px",
    "map.summaryCoarse": "Mappato solo dal contorno dello schermo (punti non trovati).",
    "map.notRunning": "Avvia il motore per mappare lo schermo.",
    "progress.black": "Mappatura dello schermo (1/4)…",
    "progress.white": "Mappatura dello schermo (2/4)…",
    "progress.dots": "Mappatura dello schermo (3/4)…",
    "progress.coding": "Mappatura dello schermo (4/4)…",
    "progress.solving": "Calcolo della mappatura…",
    "notification.unmapped":
      "Prima mappa lo schermo: apri il pannello della fotocamera e premi Mappa schermo",
    "notification.mapping": "Mappatura dello schermo: resta fuori dall'inquadratura",
    "notification.done": "Schermo mappato",
    "notification.prompt": "Alza la mano davanti allo schermo per suonare",
    "notification.layoutChanged":
      "La finestra ha cambiato dimensione dopo la mappatura: torna a schermo intero o mappa di nuovo",
    "notification.failed": "Mappatura non riuscita: {{reason}}",
    "preview.title": "Fotocamera",
    "preview.hide": "Nascondi anteprima fotocamera",
    "preview.move": "Sposta anteprima fotocamera",
    "preview.resize": "Ridimensiona anteprima fotocamera",
    "errors.WallCameraStartError": "Impossibile avviare la fotocamera.",
    "errors.WallModelLoadError": "Impossibile caricare i modelli di tracciamento.",
    "errors.WallNotRunningError": "Avvia la fotocamera prima di mappare lo schermo.",
    "errors.ScreenNotFoundError":
      "Schermo non trovato. Punta la fotocamera sullo schermo e verifica che sia tutto visibile.",
    "errors.MappingAbortedError": "Mappatura annullata.",
    "errors.MappingUnreliableError":
      "Trovati troppo pochi punti: nessuno deve stare tra la fotocamera e lo schermo, poi mappa di nuovo. La mappatura precedente resta valida.",
    "countdown.stepAway": "Mappatura dello schermo: esci dall'inquadratura della fotocamera",
  },
});

export const { t, useT } = createTranslation(wallDetectionPluginId, messages);

export const useErrorText = () => useNamespaceErrorText(wallDetectionPluginId);
