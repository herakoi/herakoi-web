import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { pipelineConfig } from "../pipelineConfig";
import { PIPELINE_PREFERENCES_KEY } from "./persistenceKeys";

export type PipelineStatus =
  | { status: "idle" }
  | { status: "initializing" }
  | { status: "running" }
  | { status: "error"; errorMessage: string };

/**
 * Shell-level pipeline state.
 *
 * Plugin-specific state has been moved to plugin stores. Only shell concerns
 * and active plugin selections remain here.
 */
type PipelineState = {
  // Pipeline lifecycle
  status: PipelineStatus;

  // Active plugin selections (persisted)
  activeDetectionId: string;
  activeSamplingId: string;
  activeSonificationId: string;
  activeVisualizerId: string | null;

  // Shell UI state
  baseUiOpacity: number; // User's preferred opacity (0-1), used by idle dimmer
  uiOpacity: number; // Actual current opacity (0-1), controlled by idle dimmer
  dimLogoMark: boolean;
};

type PipelineActions = {
  setStatus: (status: PipelineStatus) => void;
  setActiveDetectionId: (id: string) => void;
  setActiveSamplingId: (id: string) => void;
  setActiveSonificationId: (id: string) => void;
  setActiveVisualizerId: (id: string | null) => void;
  setBaseUiOpacity: (opacity: number) => void;
  setUiOpacity: (opacity: number) => void;
  setDimLogoMark: (dim: boolean) => void;
  resetPreferences: () => void;
};

const defaultPreferences = {
  // Default to first plugin in each slot
  activeDetectionId: pipelineConfig.detection[0]?.id ?? "",
  activeSamplingId: pipelineConfig.sampling[0]?.id ?? "",
  activeSonificationId: pipelineConfig.sonification[0]?.id ?? "",
  activeVisualizerId: null as string | null,
  baseUiOpacity: 1,
  uiOpacity: 1,
  dimLogoMark: false,
};

const preferenceStorage =
  typeof window === "undefined" ? undefined : createJSONStorage(() => localStorage);

export const usePipelineStore = create<PipelineState & PipelineActions>()(
  persist(
    (set) => ({
      status: { status: "idle" },
      ...defaultPreferences,
      setStatus: (status) => set({ status }),
      setActiveDetectionId: (id) => set({ activeDetectionId: id }),
      setActiveSamplingId: (id) => set({ activeSamplingId: id }),
      setActiveSonificationId: (id) => set({ activeSonificationId: id }),
      setActiveVisualizerId: (id) => set({ activeVisualizerId: id }),
      setBaseUiOpacity: (opacity) => set({ baseUiOpacity: opacity }),
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
        activeVisualizerId: state.activeVisualizerId,
        baseUiOpacity: state.baseUiOpacity,
        dimLogoMark: state.dimLogoMark,
      }),
    },
  ),
);
