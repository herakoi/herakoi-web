import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PIPELINE_PREFERENCES_KEY } from "./persistenceKeys";

export type FacingMode = "user" | "environment";

export type PipelineStatus = "idle" | "initializing" | "running" | "error";

export type OscillatorSettings = {
  minFreq: number;
  maxFreq: number;
  minVol: number;
  maxVol: number;
  oscillatorType: OscillatorType;
};

type PipelineState = {
  status: PipelineStatus;
  error?: string;
  mirror: boolean;
  maxHands: number;
  facingMode: FacingMode;
  oscillator: OscillatorSettings;
  imageReady: boolean;
  imageCover: boolean;
  imagePan: { x: number; y: number };
  handDetected: boolean;
  uiDimPercent: number;
  dimLogoMark: boolean;
};

type PipelineActions = {
  setStatus: (status: PipelineStatus, error?: string) => void;
  setMirror: (mirror: boolean) => void;
  setMaxHands: (maxHands: number) => void;
  setFacingMode: (facingMode: FacingMode) => void;
  setOscillator: (settings: Partial<OscillatorSettings>) => void;
  setImageReady: (ready: boolean) => void;
  setImageCover: (cover: boolean) => void;
  setImagePan: (pan: { x: number; y: number }) => void;
  setHandDetected: (hasHands: boolean) => void;
  setUiDimPercent: (percent: number) => void;
  setDimLogoMark: (dim: boolean) => void;
  resetPreferences: () => void;
};

const defaultOscillator: OscillatorSettings = {
  minFreq: 200,
  maxFreq: 700,
  minVol: 0,
  maxVol: 0.2,
  oscillatorType: "sine",
};

const defaultPreferences = {
  mirror: true,
  maxHands: 2,
  facingMode: "user" as FacingMode,
  oscillator: defaultOscillator,
  imageCover: false,
  imagePan: { x: 0, y: 0 },
  uiDimPercent: 25,
  dimLogoMark: false,
};

const preferenceStorage =
  typeof window === "undefined" ? undefined : createJSONStorage(() => localStorage);

export const usePipelineStore = create<PipelineState & PipelineActions>()(
  persist(
    (set) => ({
      status: "idle",
      ...defaultPreferences,
      imageReady: false,
      handDetected: false,
      setStatus: (status, error) => set({ status, error }),
      setMirror: (mirror) => set({ mirror }),
      setMaxHands: (maxHands) => set({ maxHands }),
      setFacingMode: (facingMode) => set({ facingMode }),
      setOscillator: (settings) =>
        set((state) => ({ oscillator: { ...state.oscillator, ...settings } })),
      setImageReady: (ready) => set({ imageReady: ready }),
      setImageCover: (cover) => set({ imageCover: cover }),
      setImagePan: (pan) => set({ imagePan: pan }),
      setHandDetected: (hasHands) => set({ handDetected: hasHands }),
      setUiDimPercent: (percent) => set({ uiDimPercent: percent }),
      setDimLogoMark: (dim) => set({ dimLogoMark: dim }),
      resetPreferences: () => set({ ...defaultPreferences, oscillator: { ...defaultOscillator } }),
    }),
    {
      name: PIPELINE_PREFERENCES_KEY,
      storage: preferenceStorage,
      partialize: (state) => ({
        mirror: state.mirror,
        maxHands: state.maxHands,
        facingMode: state.facingMode,
        oscillator: state.oscillator,
        imageCover: state.imageCover,
        imagePan: state.imagePan,
        uiDimPercent: state.uiDimPercent,
        dimLogoMark: state.dimLogoMark,
      }),
    },
  ),
);
