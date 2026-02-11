import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { pipelineConfig } from "../pipelineConfig";
import { PIPELINE_PREFERENCES_KEY } from "./persistenceKeys";

export type PipelineStatus = "idle" | "initializing" | "running" | "error";

// Temporary: keep oscillator settings here until sonification plugin is fully extracted
export type OscillatorSettings = {
  minFreq: number;
  maxFreq: number;
  minVol: number;
  maxVol: number;
  oscillatorType: OscillatorType;
};

/**
 * Shell-level pipeline state.
 *
 * Plugin-specific state (mirror, maxHands, facingMode) has been moved to
 * plugin stores. Only shell concerns and active plugin selections remain here.
 */
type PipelineState = {
  // Pipeline lifecycle
  status: PipelineStatus;
  error?: string;

  // Active plugin selections (persisted)
  activeDetectionId: string;
  activeSamplingId: string;
  activeSonificationId: string;

  // Pipeline signals (written by plugins via shell callbacks)
  imageReady: boolean;

  // Temporary: sampling/sonification state until fully extracted
  oscillator: OscillatorSettings;
  imageCover: boolean;
  imagePan: { x: number; y: number };

  // Shell UI state
  uiOpacity: number; // 0 = fully dimmed, 1 = fully visible
  dimLogoMark: boolean;
};

type PipelineActions = {
  setStatus: (status: PipelineStatus, error?: string) => void;
  setActiveDetectionId: (id: string) => void;
  setActiveSamplingId: (id: string) => void;
  setActiveSonificationId: (id: string) => void;
  setImageReady: (ready: boolean) => void;
  setOscillator: (settings: Partial<OscillatorSettings>) => void;
  setImageCover: (cover: boolean) => void;
  setImagePan: (pan: { x: number; y: number }) => void;
  setUiOpacity: (opacity: number) => void;
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
  // Default to first plugin in each slot
  activeDetectionId: pipelineConfig.detection[0]?.id ?? "",
  activeSamplingId: pipelineConfig.sampling[0]?.id ?? "",
  activeSonificationId: pipelineConfig.sonification[0]?.id ?? "",
  oscillator: defaultOscillator,
  imageCover: false,
  imagePan: { x: 0, y: 0 },
  uiOpacity: 1,
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
      setStatus: (status, error) => set({ status, error }),
      setActiveDetectionId: (id) => set({ activeDetectionId: id }),
      setActiveSamplingId: (id) => set({ activeSamplingId: id }),
      setActiveSonificationId: (id) => set({ activeSonificationId: id }),
      setImageReady: (ready) => set({ imageReady: ready }),
      setOscillator: (settings) =>
        set((state) => ({ oscillator: { ...state.oscillator, ...settings } })),
      setImageCover: (cover) => set({ imageCover: cover }),
      setImagePan: (pan) => set({ imagePan: pan }),
      setUiOpacity: (opacity) => set({ uiOpacity: opacity }),
      setDimLogoMark: (dim) => set({ dimLogoMark: dim }),
      resetPreferences: () => set({ ...defaultPreferences, oscillator: { ...defaultOscillator } }),
    }),
    {
      name: PIPELINE_PREFERENCES_KEY,
      storage: preferenceStorage,
      partialize: (state) => ({
        activeDetectionId: state.activeDetectionId,
        activeSamplingId: state.activeSamplingId,
        activeSonificationId: state.activeSonificationId,
        oscillator: state.oscillator,
        imageCover: state.imageCover,
        imagePan: state.imagePan,
        uiOpacity: state.uiOpacity,
        dimLogoMark: state.dimLogoMark,
      }),
    },
  ),
);
