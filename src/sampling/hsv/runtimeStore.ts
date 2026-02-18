/**
 * HSV sampling runtime state store.
 *
 * Manages transient state that changes during execution but should NOT persist
 * across sessions. This includes image readiness indicator.
 *
 * Configuration (imageCover, imagePan, currentImageSrc) is managed by the
 * framework in appConfigStore.
 */

import { create } from "zustand";

export interface HSVRuntimeState {
  /** Whether the image has been loaded and encoded */
  imageReady: boolean;
}

export interface HSVRuntimeActions {
  setImageReady: (ready: boolean) => void;
}

const defaultState: HSVRuntimeState = {
  imageReady: false,
};

export const useHSVRuntimeStore = create<HSVRuntimeState & HSVRuntimeActions>((set) => ({
  ...defaultState,
  setImageReady: (ready) => set({ imageReady: ready }),
}));
