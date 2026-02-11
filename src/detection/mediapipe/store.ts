import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type MediaPipeFacingMode = "user" | "environment";

type MediaPipeDetectionState = {
  mirror: boolean;
  maxHands: number;
  facingMode: MediaPipeFacingMode;
  handDetected: boolean; // Plugin-local state for dimming
};

type MediaPipeDetectionActions = {
  setMirror: (mirror: boolean) => void;
  setMaxHands: (maxHands: number) => void;
  setFacingMode: (facingMode: MediaPipeFacingMode) => void;
  setHandDetected: (detected: boolean) => void;
};

const STORAGE_KEY = "herakoi.detection.mediapipe.v1";

const defaultState: MediaPipeDetectionState = {
  mirror: true,
  maxHands: 2,
  facingMode: "user",
  handDetected: false,
};

export const useMediaPipeDetectionStore = create<
  MediaPipeDetectionState & MediaPipeDetectionActions
>()(
  persist(
    (set) => ({
      ...defaultState,
      setMirror: (mirror) => set({ mirror }),
      setMaxHands: (maxHands) => set({ maxHands }),
      setFacingMode: (facingMode) => set({ facingMode }),
      setHandDetected: (detected) => set({ handDetected: detected }),
    }),
    {
      name: STORAGE_KEY,
      storage: typeof window === "undefined" ? undefined : createJSONStorage(() => localStorage),
    },
  ),
);
