import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type OscillatorSettings = {
  minFreq: number;
  maxFreq: number;
  minVol: number;
  maxVol: number;
  oscillatorType: OscillatorType;
};

type OscillatorSonificationActions = {
  setSettings: (settings: Partial<OscillatorSettings>) => void;
  resetToDefaults: () => void;
};

const STORAGE_KEY = "herakoi.sonification.oscillator.v1";

export const defaultOscillatorSettings: OscillatorSettings = {
  minFreq: 200,
  maxFreq: 700,
  minVol: 0,
  maxVol: 0.2,
  oscillatorType: "sine",
};

export const useOscillatorSonificationStore = create<
  OscillatorSettings & OscillatorSonificationActions
>()(
  persist(
    (set) => ({
      ...defaultOscillatorSettings,
      setSettings: (settings) => set(settings),
      resetToDefaults: () => set(defaultOscillatorSettings),
    }),
    {
      name: STORAGE_KEY,
      storage: typeof window === "undefined" ? undefined : createJSONStorage(() => localStorage),
    },
  ),
);
