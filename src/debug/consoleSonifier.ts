import { Sonifier } from "#src/deprecated/audio/sonification";
export const setupConsoleSonifier = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  const consoleSonifier = new Sonifier();

  const playTone = (toneId: string, frequency: number, volume: number) => {
    consoleSonifier.updateTone(toneId, { frequency, volume });
  };

  window.debugSonifier = playTone;
  window.HERAKOI_DEBUG = {
    playTone,
  };
};

declare global {
  interface Window {
    debugSonifier?: (id: string, frequency: number, volume: number) => void;
    HERAKOI_DEBUG?: {
      playTone: (toneId: string, frequency: number, volume: number) => void;
    };
  }
}
