/**
 * Application runtime state store.
 *
 * Manages transient state that changes during execution but should NOT persist
 * across sessions. This includes pipeline status, current UI opacity (controlled
 * by idle dimmer), and other dynamic application state.
 *
 * Unlike appConfigStore, this store has NO persistence middleware.
 */

import { create } from "zustand";

// ──────────────────────────────────────────────────
// Type Definitions
// ──────────────────────────────────────────────────

export type PipelineStatus =
  | { status: "idle" }
  | { status: "initializing" }
  | { status: "running" }
  | { status: "error"; errorMessage: string };

export interface AppRuntimeState {
  /** Current pipeline lifecycle status */
  pipelineStatus: PipelineStatus;
  /** Current UI opacity (0-1), controlled by idle dimmer */
  currentUiOpacity: number;
  /** Whether any detection plugin is currently detecting points (generic, plugin-agnostic) */
  hasDetectedPoints: boolean;
}

export interface AppRuntimeActions {
  /** Update pipeline status */
  setStatus: (status: PipelineStatus) => void;
  /** Update current UI opacity (idle dimmer control) */
  setCurrentUiOpacity: (opacity: number) => void;
  /** Update whether any points are detected (for idle dimming) */
  setHasDetectedPoints: (hasPoints: boolean) => void;
}

// ──────────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────────

const defaultState: AppRuntimeState = {
  pipelineStatus: { status: "idle" },
  currentUiOpacity: 1,
  hasDetectedPoints: false,
};

export const useAppRuntimeStore = create<AppRuntimeState & AppRuntimeActions>((set) => ({
  ...defaultState,

  setStatus: (status) => set({ pipelineStatus: status }),

  setCurrentUiOpacity: (opacity) => set({ currentUiOpacity: opacity }),

  setHasDetectedPoints: (hasPoints) => set({ hasDetectedPoints: hasPoints }),
}));
