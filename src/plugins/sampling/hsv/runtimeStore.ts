/**
 * HSV sampling runtime state store.
 *
 * Manages transient state that changes during execution but should NOT persist
 * across sessions. This includes image readiness indicator.
 *
 * Configuration (viewportMode, currentImageId) is managed by the
 * framework in appConfigStore.
 */

import { create } from "zustand";
import type { ImageEntry } from "./types/image";

export interface HSVRuntimeState {
  /** Whether the image has been loaded and encoded */
  imageReady: boolean;
  /** User uploaded images cached for the HSV image library */
  uploads: ImageEntry[];
  /** Whether upload cache has been hydrated from localStorage */
  uploadsHydrated: boolean;
}

export interface HSVRuntimeActions {
  setImageReady: (ready: boolean) => void;
  hydrateUploads: () => void;
  upsertUpload: (entry: ImageEntry) => void;
  removeUpload: (id: string) => void;
}

const IMAGE_CACHE_KEY = "herakoi.image-cache.v1";

const readUploadCache = (): ImageEntry[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(IMAGE_CACHE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as ImageEntry[];
    return parsed
      .filter((entry) => entry.kind === "upload")
      .map((entry) => ({ ...entry, previewSrc: entry.previewSrc ?? entry.src }));
  } catch {
    return [];
  }
};

const persistUploadCache = (uploads: ImageEntry[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(uploads));
  } catch {
    // ignore
  }
};

const defaultState: HSVRuntimeState = {
  imageReady: false,
  uploads: [],
  uploadsHydrated: false,
};

export const useHSVRuntimeStore = create<HSVRuntimeState & HSVRuntimeActions>((set, get) => ({
  ...defaultState,
  setImageReady: (ready) => set({ imageReady: ready }),
  hydrateUploads: () => {
    if (get().uploadsHydrated) return;
    set({
      uploads: readUploadCache(),
      uploadsHydrated: true,
    });
  },
  upsertUpload: (entry) =>
    set((state) => {
      const uploads = [entry, ...state.uploads.filter((item) => item.id !== entry.id)];
      persistUploadCache(uploads);
      return { uploads, uploadsHydrated: true };
    }),
  removeUpload: (id) =>
    set((state) => {
      const uploads = state.uploads.filter((item) => item.id !== id);
      persistUploadCache(uploads);
      return { uploads, uploadsHydrated: true };
    }),
}));
