/**
 * Application runtime state store.
 *
 * Manages transient state that changes during execution but should NOT persist
 * across sessions. This includes engine status, current UI opacity (controlled
 * by idle dimmer), and other dynamic application state.
 *
 * Unlike appConfigStore, this store has NO persistence middleware.
 */

import { create } from "zustand";
import type { EngineRuntimeError } from "#src/core/domain-errors";

// ──────────────────────────────────────────────────
// Type Definitions
// ──────────────────────────────────────────────────

export type EngineStatus =
  | { status: "idle" }
  | { status: "initializing" }
  | { status: "running" }
  | { status: "error"; error: EngineRuntimeError };

export interface AppRuntimeState {
  /** Current engine lifecycle status */
  engineStatus: EngineStatus;
  /** Current UI opacity (0-1), controlled by idle dimmer */
  currentUiOpacity: number;
  /** Whether any detection plugin is currently detecting points (generic, plugin-agnostic) */
  hasDetectedPoints: boolean;
}

export interface AppRuntimeActions {
  /** Update engine status */
  setStatus: (status: EngineStatus) => void;
  /** Update current UI opacity (idle dimmer control) */
  setCurrentUiOpacity: (opacity: number) => void;
  /** Update whether any points are detected (for idle dimming) */
  setHasDetectedPoints: (hasPoints: boolean) => void;
}

// ──────────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────────

const defaultState: AppRuntimeState = {
  engineStatus: { status: "idle" },
  currentUiOpacity: 1,
  hasDetectedPoints: false,
};

export const useAppRuntimeStore = create<AppRuntimeState & AppRuntimeActions>((set) => ({
  ...defaultState,

  setStatus: (status) => set({ engineStatus: status }),

  setCurrentUiOpacity: (opacity) => set({ currentUiOpacity: opacity }),

  setHasDetectedPoints: (hasPoints) => set({ hasDetectedPoints: hasPoints }),
}));
