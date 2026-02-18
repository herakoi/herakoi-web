/**
 * MediaPipe detection runtime state store.
 *
 * Manages transient state that changes during execution but should NOT persist
 * across sessions. This includes hand detection status for idle dimming.
 *
 * Configuration (mirror, maxHands, facingMode) is managed by the framework
 * in appConfigStore.
 */

import { create } from "zustand";

export interface MediaPipeRuntimeState {
  /** Whether hands are currently detected (used for idle dimming) */
  handDetected: boolean;
}

export interface MediaPipeRuntimeActions {
  setHandDetected: (detected: boolean) => void;
}

const defaultState: MediaPipeRuntimeState = {
  handDetected: false,
};

export const useMediaPipeRuntimeStore = create<MediaPipeRuntimeState & MediaPipeRuntimeActions>(
  (set) => ({
    ...defaultState,
    setHandDetected: (detected) => set({ handDetected: detected }),
  }),
);
