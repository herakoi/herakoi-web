/**
 * The format-neutral image the layers plugin works with: equally sized float layers.
 *
 * Why: FITS files and ordinary images (PNG, JPEG, …) should behave the same once
 * loaded: an ordinary image is just three layers (red, green, blue).
 * What: the LayerCube type, the memory limits shared by all loaders, and
 * imageToCube() for browser-decodable images.
 */

/** Largest side of a layer after decimation. */
export const MAX_LAYER_SIDE = 2048;
/** Most values kept across all layers (128 MB of Float32). */
export const MAX_TOTAL_VALUES = 32_000_000;
/** Most layers one image may hold. */
export const MAX_LAYERS = 32;

export type Layer = {
  name: string;
  unit?: string;
  /** Row-major, top row first; NaN marks blank pixels. */
  data: Float32Array;
  /**
   * Fixed value range shown as black to full intensity (e.g. 0–255 for 8-bit images).
   * Without it, the layer is clipped to its own 0.5–99.5 percentile range.
   */
  range?: { low: number; high: number };
};

export type LayerCube = {
  width: number;
  height: number;
  /** Size in the file, before decimation. */
  sourceWidth: number;
  sourceHeight: number;
  layers: Layer[];
};

/** Keep every n-th pixel so the cube stays within MAX_LAYER_SIDE and MAX_TOTAL_VALUES. */
export const decimationStride = (width: number, height: number, layerCount: number) =>
  Math.max(
    1,
    Math.ceil(Math.max(width, height) / MAX_LAYER_SIDE),
    Math.ceil(Math.sqrt((width * height * Math.max(1, layerCount)) / MAX_TOTAL_VALUES)),
  );

export const rgbLayerNames = ["Red", "Green", "Blue"] as const;

/**
 * Split RGBA bytes into red, green and blue layers (0–255). Fully transparent pixels
 * have no data and become NaN.
 */
export const rgbaToCube = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  sourceSize = { width, height },
): LayerCube => {
  const size = width * height;
  const layers = rgbLayerNames.map((name, channel) => {
    const data = new Float32Array(size);
    for (let i = 0; i < size; i += 1) {
      data[i] = rgba[i * 4 + 3] === 0 ? Number.NaN : rgba[i * 4 + channel];
    }
    return { name, data, range: { low: 0, high: 255 } };
  });
  return {
    width,
    height,
    sourceWidth: sourceSize.width,
    sourceHeight: sourceSize.height,
    layers,
  };
};

/** Decode an image or canvas into a three-layer cube, decimated like FITS files. */
export const imageToCube = (image: HTMLImageElement | HTMLCanvasElement): LayerCube => {
  const sourceWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const sourceHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
  if (!sourceWidth || !sourceHeight) {
    throw new Error("Image has no size.");
  }
  const stride = decimationStride(sourceWidth, sourceHeight, 3);
  const width = Math.ceil(sourceWidth / stride);
  const height = Math.ceil(sourceHeight / stride);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to acquire a 2D context for image decoding.");
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  return rgbaToCube(data, width, height, { width: sourceWidth, height: sourceHeight });
};
