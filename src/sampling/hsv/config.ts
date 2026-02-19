export const hsvSamplingPluginId = "sampling/hsv" as const;

export interface HSVSamplingConfig {
  imageCover: boolean;
  imagePan: { x: number; y: number };
  currentImageId: string | null;
}

export const defaultHSVSamplingConfig: HSVSamplingConfig = {
  imageCover: false,
  imagePan: { x: 0, y: 0 },
  currentImageId: null,
};
