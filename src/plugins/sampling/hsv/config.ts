export const hsvSamplingPluginId = "sampling/hsv" as const;

export type HSVViewportMode =
  | { kind: "contain" }
  | { kind: "cover"; pan: { x: number; y: number }; zoom: number; rotation: number };

export interface HSVSamplingConfig {
  viewportMode: HSVViewportMode;
  currentImageId: string | null;
  panInteractionEnabled: boolean;
}

export const defaultHSVSamplingConfig: HSVSamplingConfig = {
  viewportMode: { kind: "contain" },
  currentImageId: null,
  panInteractionEnabled: false,
};
