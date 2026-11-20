import { create } from "zustand";
import type { MappingStep, Pattern } from "./lib/screenMapping";

export type WallMappingState =
  | { status: "idle" }
  | { status: "running"; step: MappingStep }
  | { status: "done" }
  | { status: "error"; error: Error };

interface WallStoreState {
  /** Pattern the calibration overlay should show full screen (null = hidden). */
  pattern: Pattern | null;
  /** Called by the overlay once a pattern change has been painted. */
  patternPainted: (() => void) | null;
  mapping: WallMappingState;
  /** Starts the screen mapping on the running detector (null when the engine is stopped). */
  runMapping: (() => Promise<void>) | null;
  /** Canvas the detector draws its camera preview into. */
  previewCanvas: HTMLCanvasElement | null;
  /** Whether a usable screen mapping exists for the running camera. */
  mapped: boolean;
  /** Whether a playing hand is on screen. null = engine not running. */
  hasHands: boolean | null;
  cameraError: Error | null;
  setPattern: (pattern: Pattern | null, painted: (() => void) | null) => void;
  setMapping: (mapping: WallMappingState) => void;
  setRunMapping: (fn: (() => Promise<void>) | null) => void;
  setPreviewCanvas: (canvas: HTMLCanvasElement | null) => void;
  setMapped: (mapped: boolean) => void;
  setHasHands: (hasHands: boolean | null) => void;
  setCameraError: (error: Error | null) => void;
}

export const useWallStore = create<WallStoreState>((set) => ({
  pattern: null,
  patternPainted: null,
  mapping: { status: "idle" },
  runMapping: null,
  previewCanvas: null,
  mapped: false,
  hasHands: null,
  cameraError: null,
  setPattern: (pattern, patternPainted) => set({ pattern, patternPainted }),
  setMapping: (mapping) => set({ mapping }),
  setRunMapping: (runMapping) => set({ runMapping }),
  setPreviewCanvas: (previewCanvas) => set({ previewCanvas }),
  setMapped: (mapped) => set({ mapped }),
  setHasHands: (hasHands) => set({ hasHands }),
  setCameraError: (cameraError) => set({ cameraError }),
}));
