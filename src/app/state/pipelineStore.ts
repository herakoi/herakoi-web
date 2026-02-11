import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { pipelineConfig } from "../pipelineConfig";
import { PIPELINE_PREFERENCES_KEY } from "./persistenceKeys";

export type PipelineStatus = "idle" | "initializing" | "running" | "error";

/**
 * Shell-level pipeline state.
 *
 * Plugin-specific state has been moved to plugin stores. Only shell concerns
 * and active plugin selections remain here.
 */
type PipelineState = {
  // Pipeline lifecycle
  status: PipelineStatus;
  error?: string;

  // Active plugin selections (persisted)
  activeDetectionId: string;
  activeSamplingId: string;
  activeSonificationId: string;

  // Shell UI state
  uiOpacity: number; // 0 = fully dimmed, 1 = fully visible
  dimLogoMark: boolean;
};

type PipelineActions = {
  setStatus: (status: PipelineStatus, error?: string) => void;
  setActiveDetectionId: (id: string) => void;
  setActiveSamplingId: (id: string) => void;
  setActiveSonificationId: (id: string) => void;
  setUiOpacity: (opacity: number) => void;
  setDimLogoMark: (dim: boolean) => void;
  resetPreferences: () => void;
};

const defaultPreferences = {
  // Default to first plugin in each slot
  activeDetectionId: pipelineConfig.detection[0]?.id ?? "",
  activeSamplingId: pipelineConfig.sampling[0]?.id ?? "",
  activeSonificationId: pipelineConfig.sonification[0]?.id ?? "",
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
      setUiOpacity: (opacity) => set({ uiOpacity: opacity }),
      setDimLogoMark: (dim) => set({ dimLogoMark: dim }),
      resetPreferences: () => set({ ...defaultPreferences }),
    }),
    {
      name: PIPELINE_PREFERENCES_KEY,
      storage: preferenceStorage,
      partialize: (state) => ({
        activeDetectionId: state.activeDetectionId,
        activeSamplingId: state.activeSamplingId,
        activeSonificationId: state.activeSonificationId,
        uiOpacity: state.uiOpacity,
        dimLogoMark: state.dimLogoMark,
      }),
    },
  ),
);
