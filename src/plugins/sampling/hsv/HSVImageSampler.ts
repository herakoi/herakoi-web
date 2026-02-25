/**
 * HSVImageSampler implements the ImageSampler interface by pre-encoding an image
 * into hue/value byte data and serving normalized-coordinate lookups.
 *
 * Why: We want the controller to ask for color data without touching raw ImageData,
 * keeping all RGB→HSV work centralized and reusable across detectors.
 * What: loadImage() pulls pixels from a canvas or image/URL, converts them once to
 * hue/value bytes, and sampleAt() maps normalized points to those precomputed bytes.
 * How: We normalize coordinates (0-1) to pixel indices, clamp to bounds, and return
 * a flexible data record so downstream sonifiers can choose the fields they need.
 */

import type {
  DetectedPoint,
  ErrorOr,
  ImageSample as ImageSampleResult,
  ImageSampler as ImageSamplerInterface,
} from "#src/core/interfaces";

type EncodedImage = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

const encodeHSV = (imageData: ImageData): EncodedImage => {
  const encoded = new Uint8ClampedArray(imageData.data.length);

  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i] / 255;
    const g = imageData.data[i + 1] / 255;
    const b = imageData.data[i + 2] / 255;

    const cmax = Math.max(r, g, b);
    const cmin = Math.min(r, g, b);
    const delta = cmax - cmin;

    let h = 0;
    if (delta !== 0) {
      if (cmax === r) {
        h = 60 * (((g - b) / delta) % 6);
      } else if (cmax === g) {
        h = 60 * ((b - r) / delta + 2);
      } else {
        h = 60 * ((r - g) / delta + 4);
      }
    }

    if (h < 0) h += 360;

    const s = cmax === 0 ? 0 : delta / cmax;
    const v = cmax;

    const hByte = Math.round((h / 360) * 255);
    const sByte = Math.round(s * 255);
    const vByte = Math.round(v * 255);

    encoded[i] = hByte;
    encoded[i + 1] = sByte;
    encoded[i + 2] = vByte;
    encoded[i + 3] = imageData.data[i + 3];
  }

  return { data: encoded, width: imageData.width, height: imageData.height };
};

type LoadableSource = string | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas;

export class HSVImageSampler implements ImageSamplerInterface {
  private encoded: EncodedImage | null = null;

  /**
   * Load pixels from an image, URL, or canvas and pre-encode them for sampling.
   */
  async loadImage(source: LoadableSource): Promise<ErrorOr<undefined>> {
    try {
      const canvas = await this.toCanvas(source);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return new Error("HSVImageSampler could not acquire a 2D context for decoding.");
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      this.encoded = encodeHSV(imageData);
    } catch (error) {
      return error instanceof Error ? error : new Error("Failed to load image for HSV sampling.");
    }
  }

  /**
   * Sample the pre-encoded HSV data at a normalized point.
   */
  sampleAt(point: DetectedPoint): ErrorOr<ImageSampleResult | null> {
    if (!this.encoded) return null;

    const { width, height, data } = this.encoded;
    if (width === 0 || height === 0) return null;

    if (point.x < 0 || point.y < 0 || point.x > 1 || point.y > 1) {
      return null;
    }

    const pixelX = Math.min(width - 1, Math.max(0, Math.round(point.x * (width - 1))));
    const pixelY = Math.min(height - 1, Math.max(0, Math.round(point.y * (height - 1))));

    const i = (pixelY * width + pixelX) * 4;

    return {
      data: {
        hueByte: data[i],
        saturationByte: data[i + 1],
        valueByte: data[i + 2],
        alpha: data[i + 3],
      },
    };
  }

  private async toCanvas(source: LoadableSource): Promise<HTMLCanvasElement> {
    if (typeof source === "string") {
      return this.loadFromUrl(source);
    }

    if (this.isCanvasLike(source)) {
      return source;
    }

    if (typeof OffscreenCanvas !== "undefined" && source instanceof OffscreenCanvas) {
      const canvas = document.createElement("canvas");
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext("2d");
      const offscreenCtx = source.getContext("2d");
      if (!ctx || !offscreenCtx) {
        throw new Error("Unable to copy from OffscreenCanvas: missing 2D context.");
      }
      const imageData = offscreenCtx.getImageData(0, 0, source.width, source.height);
      ctx.putImageData(imageData, 0, 0);
      return canvas;
    }

    if (source instanceof HTMLImageElement) {
      const canvas = document.createElement("canvas");
      canvas.width = source.naturalWidth;
      canvas.height = source.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Unable to acquire 2D context for image decoding.");
      }
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      return canvas;
    }

    throw new Error("Unsupported image source provided to HSVImageSampler.");
  }

  private isCanvasLike(source: unknown): source is HTMLCanvasElement {
    return (
      typeof source === "object" &&
      source !== null &&
      "getContext" in source &&
      typeof (source as { getContext?: unknown }).getContext === "function" &&
      "width" in source &&
      "height" in source
    );
  }

  private loadFromUrl(url: string): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Unable to acquire 2D context for URL image decoding."));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
      };
      img.onerror = (error) => reject(error);
      img.src = url;
    });
  }
}

export type ImageSample = ImageSampleResult;
export type ImageSampler = ImageSamplerInterface;
