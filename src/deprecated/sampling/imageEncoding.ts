/**
 * @deprecated This file is being replaced by src/sampling/hsv/HSVImageSampler.ts which
 * implements the ImageSampler interface with full HSV support (including saturation)
 * and normalized coordinates. Use HSVImageSampler for new code. This legacy
 * implementation will be removed in a future version once all dependents are migrated.
 *
 * Migration guide:
 * - Old: new ImageSampler(canvas) → New: await sampler.loadImage(canvas)
 * - Old: sampleAtPixel(x, y) → New: sampleAt({id, x: x/width, y: y/height})
 * - Old: returns {hueByte, valueByte} → New: returns {hueByte, saturationByte, valueByte}
 */

/**
 * We keep image loading and pixel sampling in one place so the controller only asks
 * for "give me hue/value at this point" and never touches raw ImageData. This mirrors
 * the modernization plan for step 3: store the uploaded image once, expose simple
 * sampling helpers, and hide the encoding details that turn RGB into sonification-friendly bytes.
 */

export type PixelSample = { hueByte: number; valueByte: number; alpha: number };

const encodeHueValue = (imageData: ImageData) => {
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

    const v = cmax;
    const hByte = Math.round((h / 360) * 255);
    const vByte = Math.round(v * 255);

    encoded[i] = hByte;
    encoded[i + 1] = hByte;
    encoded[i + 2] = vByte;
    encoded[i + 3] = imageData.data[i + 3];
  }

  return encoded;
};

export class ImageSampler {
  private encoded: Uint8ClampedArray | null = null;
  private width = 0;
  private height = 0;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("ImageSampler could not acquire a 2D context for decoding.");
    }

    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    this.width = imageData.width;
    this.height = imageData.height;
    this.encoded = encodeHueValue(imageData);
  }

  public sampleAtPixel(x: number, y: number): PixelSample | null {
    if (!this.encoded) {
      return null;
    }

    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return null;
    }

    const i = (y * this.width + x) * 4;

    return {
      hueByte: this.encoded[i],
      valueByte: this.encoded[i + 2],
      alpha: this.encoded[i + 3],
    };
  }
}
