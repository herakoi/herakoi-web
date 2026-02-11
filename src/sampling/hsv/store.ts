import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type HSVSamplingState = {
  imageCover: boolean;
  imagePan: { x: number; y: number };
  currentImageSrc: string | null;
  imageReady: boolean;
};

type HSVSamplingActions = {
  setImageCover: (cover: boolean) => void;
  setImagePan: (pan: { x: number; y: number }) => void;
  setCurrentImageSrc: (src: string | null) => void;
  setImageReady: (ready: boolean) => void;
};

const STORAGE_KEY = "herakoi.sampling.hsv.v1";

const defaultState: HSVSamplingState = {
  imageCover: false,
  imagePan: { x: 0, y: 0 },
  currentImageSrc: null,
  imageReady: false,
};

export const useHSVSamplingStore = create<HSVSamplingState & HSVSamplingActions>()(
  persist(
    (set) => ({
      ...defaultState,
      setImageCover: (cover) => set({ imageCover: cover }),
      setImagePan: (pan) => set({ imagePan: pan }),
      setCurrentImageSrc: (src) => set({ currentImageSrc: src }),
      setImageReady: (ready) => set({ imageReady: ready }),
    }),
    {
      name: STORAGE_KEY,
      storage: typeof window === "undefined" ? undefined : createJSONStorage(() => localStorage),
      partialize: (state) => ({
        imageCover: state.imageCover,
        imagePan: state.imagePan,
        currentImageSrc: state.currentImageSrc,
      }),
    },
  ),
);
