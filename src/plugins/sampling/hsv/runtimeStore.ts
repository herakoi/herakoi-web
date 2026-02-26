/**
 * HSV sampling runtime state store.
 *
 * Manages transient state that changes during execution but should NOT persist
 * across sessions. This includes image readiness indicator.
 *
 * Persistent configuration (currentImageId) is managed by appConfigStore.
 * Viewport interactions (cover/pan/zoom/rotate lock state) stay runtime-only.
 */

import { create } from "zustand";
import type { HSVViewportMode } from "./config";
import type { ImageLibraryRuntimeError } from "./errors";
import { UploadCacheReadError, UploadCacheWriteError } from "./errors";
import type { ImageEntry } from "./types/image";

export type ImageLibraryError = ImageLibraryRuntimeError;

export type ImageLibraryStatus = { status: "ok" } | { status: "error"; error: ImageLibraryError };

export interface HSVRuntimeState {
  /** Whether the image has been loaded and encoded */
  imageReady: boolean;
  /** Runtime viewport mode for image rendering and interactions. */
  viewportMode: HSVViewportMode;
  /** Whether cover viewport mode is currently active. */
  coverModeActive: boolean;
  /** Whether cover image editing interactions are unlocked. */
  panInteractionEnabled: boolean;
  /** Incremented each time cover mode is activated to retrigger guidance notifications. */
  coverModeActivationToken: number;
  /** User uploaded images cached for the HSV image library */
  uploads: ImageEntry[];
  /** Whether upload cache has been hydrated from localStorage */
  uploadsHydrated: boolean;
  /** Runtime error state for image library operations. */
  imageLibraryStatus: ImageLibraryStatus;
}

export interface HSVRuntimeActions {
  setImageReady: (ready: boolean) => void;
  setViewportMode: (mode: HSVViewportMode) => void;
  setCoverModeActive: (active: boolean) => void;
  setPanInteractionEnabled: (enabled: boolean) => void;
  notifyCoverModeActivated: () => void;
  setImageLibraryOk: () => void;
  setImageLibraryError: (error: ImageLibraryError) => void;
  hydrateUploads: () => void;
  upsertUpload: (entry: ImageEntry) => void;
  removeUpload: (id: string) => void;
}

const IMAGE_CACHE_KEY = "herakoi.image-cache.v1";

const asError = (error: unknown, fallback: string): Error =>
  error instanceof Error ? error : new Error(fallback);

const readUploadCache = (): UploadCacheReadError | ImageEntry[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(IMAGE_CACHE_KEY);
  if (!stored) return [];

  const parsed = (() => {
    try {
      return JSON.parse(stored) as ImageEntry[];
    } catch (error) {
      return new UploadCacheReadError({ cause: asError(error, "Failed to parse upload cache.") });
    }
  })();

  if (parsed instanceof Error) {
    return parsed;
  }

  return parsed
    .filter((entry) => entry.kind === "upload")
    .map((entry) => ({ ...entry, previewSrc: entry.previewSrc ?? entry.src }));
};

const persistUploadCache = (uploads: ImageEntry[]): UploadCacheWriteError | undefined => {
  if (typeof window === "undefined") return;
  const result = (() => {
    try {
      localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(uploads));
    } catch (error) {
      return new UploadCacheWriteError({
        cause: asError(error, "Failed to persist upload cache."),
      });
    }
  })();
  return result;
};

const defaultState: HSVRuntimeState = {
  imageReady: false,
  viewportMode: { kind: "cover", pan: { x: 0, y: 0 }, zoom: 1, rotation: 0 },
  coverModeActive: false,
  panInteractionEnabled: false,
  coverModeActivationToken: 0,
  uploads: [],
  uploadsHydrated: false,
  imageLibraryStatus: { status: "ok" },
};

export const useHSVRuntimeStore = create<HSVRuntimeState & HSVRuntimeActions>((set, get) => ({
  ...defaultState,
  setImageReady: (ready) => set({ imageReady: ready }),
  setViewportMode: (mode) => set({ viewportMode: mode }),
  setCoverModeActive: (active) => set({ coverModeActive: active }),
  setPanInteractionEnabled: (enabled) => set({ panInteractionEnabled: enabled }),
  notifyCoverModeActivated: () =>
    set((state) => ({
      coverModeActive: true,
      coverModeActivationToken: state.coverModeActivationToken + 1,
    })),
  setImageLibraryOk: () => set({ imageLibraryStatus: { status: "ok" } }),
  setImageLibraryError: (error) => set({ imageLibraryStatus: { status: "error", error } }),
  hydrateUploads: () => {
    if (get().uploadsHydrated) return;
    const uploads = readUploadCache();
    if (uploads instanceof Error) {
      set({
        uploads: [],
        uploadsHydrated: true,
        imageLibraryStatus: {
          status: "error",
          error: uploads,
        },
      });
      return;
    }
    set({
      uploads,
      uploadsHydrated: true,
      imageLibraryStatus: { status: "ok" },
    });
  },
  upsertUpload: (entry) =>
    set((state) => {
      const uploads = [entry, ...state.uploads.filter((item) => item.id !== entry.id)];
      const persistError = persistUploadCache(uploads);
      return {
        uploads,
        uploadsHydrated: true,
        imageLibraryStatus:
          persistError instanceof Error
            ? { status: "error", error: persistError }
            : { status: "ok" },
      };
    }),
  removeUpload: (id) =>
    set((state) => {
      const uploads = state.uploads.filter((item) => item.id !== id);
      const persistError = persistUploadCache(uploads);
      return {
        uploads,
        uploadsHydrated: true,
        imageLibraryStatus:
          persistError instanceof Error
            ? { status: "error", error: persistError }
            : { status: "ok" },
      };
    }),
}));
