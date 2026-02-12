/**
 * @vitest-environment happy-dom
 *
 * This test file uses happy-dom to provide browser APIs (ImageData, canvas)
 * required by HSVImageSampler for RGB→HSV conversion testing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HSVImageSampler } from "./HSVImageSampler";

class FakeImageData {
  public readonly data: Uint8ClampedArray;
  public readonly width: number;
  public readonly height: number;

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

type FakeCtx = {
  getImageData: () => ImageData;
};

type FakeCanvas = {
  width: number;
  height: number;
  getContext: (type: "2d") => FakeCtx | null;
};

const makeImageData = (pixels: number[], width: number, height: number) =>
  new FakeImageData(new Uint8ClampedArray(pixels), width, height) as unknown as ImageData;

const makeFakeCanvas = (imageData: ImageData): FakeCanvas => {
  const ctx: FakeCtx = {
    getImageData: () => imageData,
  };

  return {
    width: imageData.width,
    height: imageData.height,
    getContext: (type: "2d") => (type === "2d" ? ctx : null),
  };
};

describe("HSVImageSampler", () => {
  beforeEach(() => {
    vi.stubGlobal("ImageData", FakeImageData);
  });

  it("encodes hue/value bytes and samples via normalized coordinates", async () => {
    const originalPixels = [
      // (0,0) pure red
      255, 0, 0, 255,
      // (1,0) pure green
      0, 255, 0, 255,
      // (0,1) pure blue
      0, 0, 255, 255,
      // (1,1) mid gray with alpha
      128, 128, 128, 200,
    ];

    const input = makeImageData(originalPixels, 2, 2);
    const canvas = makeFakeCanvas(input) as unknown as HTMLCanvasElement;

    const sampler = new HSVImageSampler();
    await sampler.loadImage(canvas);

    expect(sampler.sampleAt({ id: "p0", x: 0, y: 0 })?.data).toEqual({
      hueByte: 0,
      saturationByte: 255,
      valueByte: 255,
      alpha: 255,
    });
    expect(sampler.sampleAt({ id: "p1", x: 1, y: 0 })?.data).toEqual({
      hueByte: 85,
      saturationByte: 255,
      valueByte: 255,
      alpha: 255,
    });
    expect(sampler.sampleAt({ id: "p2", x: 0, y: 1 })?.data).toEqual({
      hueByte: 170,
      saturationByte: 255,
      valueByte: 255,
      alpha: 255,
    });
    expect(sampler.sampleAt({ id: "p3", x: 1, y: 1 })?.data).toEqual({
      hueByte: 0,
      saturationByte: 0,
      valueByte: 128,
      alpha: 200,
    });
  });

  it("rejects out-of-bounds normalized coordinates", async () => {
    const input = makeImageData(
      [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255],
      2,
      2,
    );
    const canvas = makeFakeCanvas(input) as unknown as HTMLCanvasElement;

    const sampler = new HSVImageSampler();
    await sampler.loadImage(canvas);

    expect(sampler.sampleAt({ id: "neg", x: -0.1, y: 0.5 })).toBeNull();
    expect(sampler.sampleAt({ id: "over", x: 1.1, y: 0.5 })).toBeNull();
    expect(sampler.sampleAt({ id: "overY", x: 0.5, y: 1.4 })).toBeNull();
  });

  describe("resolveLuminanceInVisualRegion", () => {
    it("returns null when no image is loaded", () => {
      const sampler = new HSVImageSampler();
      expect(sampler.resolveLuminanceInVisualRegion(0, 0, 1, 1)).toBeNull();
    });

    it("computes average perceptual luminance over a region", async () => {
      // 2x2 image: pure white (lum=1), pure black (lum=0), pure red, pure green
      const pixels = [
        // (0,0) white → luminance ≈ 1.0
        255, 255, 255, 255,
        // (1,0) black → luminance = 0.0
        0, 0, 0, 255,
        // (0,1) red → luminance ≈ 0.2126
        255, 0, 0, 255,
        // (1,1) green → luminance ≈ 0.7152
        0, 255, 0, 255,
      ];

      const input = makeImageData(pixels, 2, 2);
      const canvas = makeFakeCanvas(input) as unknown as HTMLCanvasElement;
      const sampler = new HSVImageSampler();
      await sampler.loadImage(canvas);

      // Single pixel: white
      const whiteLum = sampler.resolveLuminanceInVisualRegion(0, 0, 1, 1);
      expect(whiteLum).toBeCloseTo(1.0, 1);

      // Single pixel: black
      const blackLum = sampler.resolveLuminanceInVisualRegion(1, 0, 1, 1);
      expect(blackLum).toBeCloseTo(0.0, 1);

      // Whole image: average of all four pixels
      const avgAll = sampler.resolveLuminanceInVisualRegion(0, 0, 2, 2);
      // (1.0 + 0.0 + 0.2126 + 0.7152) / 4 ≈ 0.4820
      expect(avgAll).toBeCloseTo(0.482, 1);
    });

    it("clamps to image bounds", async () => {
      const pixels = [128, 128, 128, 255]; // single gray pixel
      const input = makeImageData(pixels, 1, 1);
      const canvas = makeFakeCanvas(input) as unknown as HTMLCanvasElement;
      const sampler = new HSVImageSampler();
      await sampler.loadImage(canvas);

      // Oversized rect still returns single pixel luminance
      const lum = sampler.resolveLuminanceInVisualRegion(0, 0, 100, 100);
      expect(lum).not.toBeNull();
      // Gray (128,128,128) → luminance = 128/255 ≈ 0.502
      expect(lum).toBeCloseTo(0.502, 1);
    });
  });
});
