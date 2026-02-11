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
 * Plugin-specific state (mirror, maxHands, facingMode, imageCover, imagePan)
 * has been moved to plugin stores. Only shell concerns and active plugin
 * selections remain here.
 */
type PipelineState = {
  // Pipeline lifecycle
  status: PipelineStatus;
  error?: string;

  // Active plugin selections (persisted)
  activeDetectionId: string;
  activeSamplingId: string;
  activeSonificationId: string;

  // Temporary: sonification state until fully extracted
  oscillator: OscillatorSettings;

  // Shell UI state
  uiOpacity: number; // 0 = fully dimmed, 1 = fully visible
  dimLogoMark: boolean;
};

type PipelineActions = {
  setStatus: (status: PipelineStatus, error?: string) => void;
  setActiveDetectionId: (id: string) => void;
  setActiveSamplingId: (id: string) => void;
  setActiveSonificationId: (id: string) => void;
  setOscillator: (settings: Partial<OscillatorSettings>) => void;
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
      setStatus: (status, error) => set({ status, error }),
      setActiveDetectionId: (id) => set({ activeDetectionId: id }),
      setActiveSamplingId: (id) => set({ activeSamplingId: id }),
      setActiveSonificationId: (id) => set({ activeSonificationId: id }),
      setOscillator: (settings) =>
        set((state) => ({ oscillator: { ...state.oscillator, ...settings } })),
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
        uiOpacity: state.uiOpacity,
        dimLogoMark: state.dimLogoMark,
      }),
    },
  ),
);
