import { create } from "zustand";

type PianoSamplerAudioState = {
  sinkId: string;
  volume: number;
  muted: boolean;
  setSinkId: (sinkId: string) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const usePianoSamplerAudioStore = create<PianoSamplerAudioState>((set) => ({
  sinkId: "",
  volume: 1,
  muted: false,
  setSinkId: (sinkId) => set({ sinkId }),
  setVolume: (volume) => set({ volume: clamp01(volume) }),
  setMuted: (muted) => set({ muted }),
}));
