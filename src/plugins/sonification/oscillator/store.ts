import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const OSCILLATOR_AUDIO_STATE_KEY = "herakoi.oscillator-audio.v1";

type OscillatorAudioState = {
  sinkId: string;
  volume: number;
  muted: boolean;
  setSinkId: (sinkId: string) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
};

const storage = typeof window === "undefined" ? undefined : createJSONStorage(() => localStorage);

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const useOscillatorAudioStore = create<OscillatorAudioState>()(
  persist(
    (set) => ({
      sinkId: "",
      volume: 1,
      muted: false,
      setSinkId: (sinkId) => set({ sinkId }),
      setVolume: (volume) => set({ volume: clamp01(volume) }),
      setMuted: (muted) => set({ muted }),
    }),
    {
      name: OSCILLATOR_AUDIO_STATE_KEY,
      storage,
      partialize: (state) => ({
        sinkId: state.sinkId,
        volume: state.volume,
        muted: state.muted,
      }),
    },
  ),
);
