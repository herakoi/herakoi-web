/**
 * Shared ref registry for the HSV sampling plugin.
 *
 * The shell registers the image canvas ref here before calling createSampler().
 * The plugin's postInitialize() reads it to draw images and encode pixels.
 */

import type { RefObject } from "react";

type HSVSamplingRefs = {
  imageCanvas: RefObject<HTMLCanvasElement> | null;
};

export const hsvSamplingRefs: HSVSamplingRefs = {
  imageCanvas: null,
};

export function registerImageCanvasRef(ref: RefObject<HTMLCanvasElement>) {
  hsvSamplingRefs.imageCanvas = ref;
}
