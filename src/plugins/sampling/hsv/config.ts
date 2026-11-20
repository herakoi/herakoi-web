export const hsvSamplingPluginId = "sampling/hsv" as const;

import type { ImageViewportMode } from "#src/shared/image/types";

export type HSVViewportMode = ImageViewportMode;

export interface HSVSamplingConfig {
  currentImageId: string | null;
}

export const defaultHSVSamplingConfig: HSVSamplingConfig = {
  currentImageId: null,
};
