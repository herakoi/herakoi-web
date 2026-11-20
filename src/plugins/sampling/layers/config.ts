export const layersSamplingPluginId = "sampling/layers" as const;

/** How the three colour layers are read: as R/G/B or as H/S/V. */
export type LayerColorMode = "rgb" | "hsv";

/** Curve applied after a layer is scaled to 0–1. */
export type LayerStretch = "linear" | "sqrt" | "log" | "asinh";

/**
 * Which layer feeds which colour channel of the shown image (and so of the hue,
 * saturation and value channels sent to the sonifier). Indices point into the image's
 * layers; -1 means no layer. Every layer is sent to the sonifier regardless.
 */
export interface LayerMapping {
  mode: LayerColorMode;
  /** Layers for R, G, B (rgb mode) or H, S, V (hsv mode). */
  channels: [number, number, number];
  stretch: LayerStretch;
}

export interface LayersSamplingConfig {
  currentImageId: string | null;
  /** Layer mapping per image id. Images without an entry use the default. */
  mappings: Record<string, LayerMapping>;
}

export const defaultLayersSamplingConfig: LayersSamplingConfig = {
  currentImageId: null,
  mappings: {},
};
