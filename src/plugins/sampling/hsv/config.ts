export const hsvSamplingPluginId = "sampling/hsv" as const;

export type HSVViewportMode =
  | { kind: "contain" }
  | { kind: "cover"; pan: { x: number; y: number }; zoom: number; rotation: number };

export interface HSVSamplingConfig {
  currentImageId: string | null;
}

export const defaultHSVSamplingConfig: HSVSamplingConfig = {
  currentImageId: null,
};
