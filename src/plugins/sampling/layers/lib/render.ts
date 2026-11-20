/**
 * Turns a LayerCube into the shown image and the values that are sampled.
 *
 * Why: layers hold floats of any range, while the screen works with bytes. The user
 * decides which layer feeds which colour channel; hue/saturation/value follow from
 * that, and every layer is also sampled on its own, scaled to 0–1.
 * What: per-layer scales (range + stretch), the display canvas and the HSV bytes of
 * every image pixel.
 * How: a layer is scaled with its fixed range (ordinary images: 0–255) or, without
 * one, its 0.5–99.5 percentile range, then stretched. In RGB mode HSV is derived from
 * the colours; in HSV mode the layers are the H/S/V values and the display is
 * converted back to RGB, so hue survives where saturation or value are zero.
 */

import type { LayerMapping, LayerStretch } from "../config";
import type { LayerCube } from "./cube";

/** Channel index meaning "no layer". */
export const NO_LAYER = -1;

const LOW_PERCENTILE = 0.005;
const HIGH_PERCENTILE = 0.995;
const PERCENTILE_SAMPLE = 200_000;

export const defaultLayerMapping = (layerCount: number): LayerMapping => ({
  mode: "rgb",
  channels: layerCount >= 3 ? [0, 1, 2] : [0, 0, 0],
  stretch: "linear",
});

/** Keep a stored mapping usable when a layer index no longer exists. */
export const sanitizeLayerMapping = (
  mapping: LayerMapping | undefined,
  layerCount: number,
): LayerMapping => {
  if (!mapping) return defaultLayerMapping(layerCount);
  const valid = (index: number) =>
    Number.isInteger(index) && index >= NO_LAYER && index < layerCount ? index : NO_LAYER;
  return {
    mode: mapping.mode === "hsv" ? "hsv" : "rgb",
    channels: [valid(mapping.channels[0]), valid(mapping.channels[1]), valid(mapping.channels[2])],
    stretch: mapping.stretch in stretchers ? mapping.stretch : "linear",
  };
};

export const isLayerMappingEqual = (left: LayerMapping, right: LayerMapping) =>
  left.mode === right.mode &&
  left.stretch === right.stretch &&
  left.channels.every((channel, index) => channel === right.channels[index]);

/** The low and high clip values of a layer, from a sample of its finite values. */
export const percentileRange = (data: Float32Array): { low: number; high: number } => {
  const step = Math.max(1, Math.floor(data.length / PERCENTILE_SAMPLE));
  const values: number[] = [];
  for (let i = 0; i < data.length; i += step) {
    const value = data[i];
    if (Number.isFinite(value)) values.push(value);
  }
  if (values.length === 0) return { low: 0, high: 1 };
  const sorted = Float64Array.from(values).sort();
  const pick = (fraction: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(fraction * (sorted.length - 1)))];
  const low = pick(LOW_PERCENTILE);
  let high = pick(HIGH_PERCENTILE);
  if (high <= low) high = sorted[sorted.length - 1];
  if (high <= low) high = low + 1;
  return { low, high };
};

const stretchers: Record<LayerStretch, (t: number) => number> = {
  linear: (t) => t,
  sqrt: (t) => Math.sqrt(t),
  log: (t) => Math.log10(1 + 999 * t) / 3,
  asinh: (t) => Math.asinh(10 * t) / Math.asinh(10),
};

/** Scales a layer's raw values to 0–1; NaN stays NaN (no data). */
export type LayerScale = (value: number) => number;

export const createLayerScales = (cube: LayerCube, stretch: LayerStretch): LayerScale[] => {
  const curve = stretchers[stretch] ?? stretchers.linear;
  return cube.layers.map((layer) => {
    const { low, high } = layer.range ?? percentileRange(layer.data);
    const span = high - low || 1;
    return (value) => {
      if (!Number.isFinite(value)) return Number.NaN;
      return curve(Math.min(1, Math.max(0, (value - low) / span)));
    };
  });
};

const hsvToRgb = (h: number, s: number, v: number): [number, number, number] => {
  const sector = (h / 60) % 6;
  const c = v * s;
  const x = c * (1 - Math.abs((sector % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    sector < 1
      ? [c, x, 0]
      : sector < 2
        ? [x, c, 0]
        : sector < 3
          ? [0, c, x]
          : sector < 4
            ? [0, x, c]
            : sector < 5
              ? [x, 0, c]
              : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
};

const rgbToHsv = (r: number, g: number, b: number): [number, number, number] => {
  const cmax = Math.max(r, g, b);
  const cmin = Math.min(r, g, b);
  const delta = cmax - cmin;
  let h = 0;
  if (delta !== 0) {
    if (cmax === r) h = 60 * (((g - b) / delta) % 6);
    else if (cmax === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;
  return [h, cmax === 0 ? 0 : delta / cmax, cmax];
};

export type LayerPixels = {
  /** RGBA bytes of the shown image. */
  display: Uint8ClampedArray;
  /** Hue, saturation, value bytes in R, G, B; alpha 0 where a colour layer has no data. */
  hsv: Uint8ClampedArray;
};

/** Display and HSV bytes for every pixel of the cube. */
export const computeLayerPixels = (
  cube: LayerCube,
  mapping: LayerMapping,
  scales: LayerScale[],
): LayerPixels => {
  const size = cube.width * cube.height;
  const display = new Uint8ClampedArray(size * 4);
  const hsv = new Uint8ClampedArray(size * 4);
  const sources = mapping.channels.map((index) =>
    index === NO_LAYER || !cube.layers[index]
      ? null
      : { data: cube.layers[index].data, scale: scales[index] },
  );
  // A missing channel is 0 in RGB mode; in HSV mode hue is 0 and saturation/value are full.
  const missing = mapping.mode === "hsv" ? [0, 1, 1] : [0, 0, 0];
  const values = [0, 0, 0];

  for (let i = 0; i < size; i += 1) {
    let blank = false;
    for (let c = 0; c < 3; c += 1) {
      const source = sources[c];
      const value = source ? source.scale(source.data[i]) : missing[c];
      if (Number.isNaN(value)) blank = true;
      values[c] = value;
    }
    const o = i * 4;
    display[o + 3] = 255;
    if (blank) continue; // Black on screen; alpha 0 in hsv marks "no data".
    hsv[o + 3] = 255;

    if (mapping.mode === "hsv") {
      const [h, s, v] = values;
      const [r, g, b] = hsvToRgb(h * 360, s, v);
      display[o] = r;
      display[o + 1] = g;
      display[o + 2] = b;
      hsv[o] = Math.round(h * 255);
      hsv[o + 1] = Math.round(s * 255);
      hsv[o + 2] = Math.round(v * 255);
    } else {
      const [r, g, b] = values;
      display[o] = Math.round(r * 255);
      display[o + 1] = Math.round(g * 255);
      display[o + 2] = Math.round(b * 255);
      const [h, s, v] = rgbToHsv(r, g, b);
      hsv[o] = Math.round((h / 360) * 255);
      hsv[o + 1] = Math.round(s * 255);
      hsv[o + 2] = Math.round(v * 255);
    }
  }

  return { display, hsv };
};

export type LayerRender = {
  mapping: LayerMapping;
  scales: LayerScale[];
  hsv: Uint8ClampedArray;
  display: HTMLCanvasElement;
};

const bytesToCanvas = (bytes: Uint8ClampedArray, width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to acquire a 2D context for layer rendering.");
  ctx.putImageData(new ImageData(new Uint8ClampedArray(bytes), width, height), 0, 0);
  return canvas;
};

export const renderLayers = (cube: LayerCube, mapping: LayerMapping): LayerRender => {
  const scales = createLayerScales(cube, mapping.stretch);
  const pixels = computeLayerPixels(cube, mapping, scales);
  return {
    mapping,
    scales,
    hsv: pixels.hsv,
    display: bytesToCanvas(pixels.display, cube.width, cube.height),
  };
};

const THUMBNAIL_SIDE = 256;

/** A small JPEG data URL of the shown image, for the image library. */
export const renderThumbnail = (cube: LayerCube, mapping: LayerMapping): string => {
  const { display } = renderLayers(cube, mapping);
  const scale = Math.min(1, THUMBNAIL_SIDE / Math.max(cube.width, cube.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cube.width * scale));
  canvas.height = Math.max(1, Math.round(cube.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to acquire a 2D context for the thumbnail.");
  ctx.drawImage(display, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
};
