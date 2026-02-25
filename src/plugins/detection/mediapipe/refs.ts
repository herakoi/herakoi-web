/**
 * Shared ref registry for the MediaPipe detection plugin.
 *
 * The DockPanel component registers its video and overlay refs here during
 * mount. The plugin's createDetector() reads them during engine initialization.
 *
 * This avoids prop drilling or context threading between the imperative factory
 * and the React render tree.
 */

import type { RefObject } from "react";

type MediaPipeRefs = {
  video: RefObject<HTMLVideoElement> | null;
  videoOverlay: RefObject<HTMLCanvasElement> | null;
  imageOverlay: RefObject<HTMLCanvasElement> | null;
};

export const mediaPipeRefs: MediaPipeRefs = {
  video: null,
  videoOverlay: null,
  imageOverlay: null,
};

export function registerVideoRef(ref: RefObject<HTMLVideoElement>) {
  mediaPipeRefs.video = ref;
}

export function registerOverlayRef(
  key: "videoOverlay" | "imageOverlay",
  ref: RefObject<HTMLCanvasElement>,
) {
  mediaPipeRefs[key] = ref;
}
