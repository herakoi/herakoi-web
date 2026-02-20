export const hsvSamplingPluginId = "sampling/hsv" as const;

export type HSVViewportMode =
  | { kind: "contain" }
  | { kind: "cover"; pan: { x: number; y: number }; zoom: number };

export interface HSVSamplingConfig {
  viewportMode: HSVViewportMode;
  currentImageId: string | null;
}

export const defaultHSVSamplingConfig: HSVSamplingConfig = {
  viewportMode: { kind: "contain" },
  currentImageId: null,
};
