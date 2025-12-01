import { beforeEach, describe, expect, it, vi } from "vitest";

import { ImageSampler } from "./imageEncoding";

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

const makeImageData = (pixels: number[], width: number, height: number) =>
  new FakeImageData(new Uint8ClampedArray(pixels), width, height) as unknown as ImageData;

type FakeCtx = {
  getImageData: () => ImageData;
};

type FakeCanvas = {
  width: number;
  height: number;
  getContext: (type: "2d") => FakeCtx | null;
};

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

const makeSampler = (imageData: ImageData) => {
  const canvas = makeFakeCanvas(imageData) as unknown as HTMLCanvasElement;
  return new ImageSampler(canvas);
};

describe("ImageSampler", () => {
  beforeEach(() => {
    vi.stubGlobal("ImageData", FakeImageData);
  });

  it("encodes hue/value bytes without mutating the input", () => {
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
    const sampler = makeSampler(input);

    // Input stays untouched
    expect(Array.from(input.data)).toEqual(originalPixels);

    expect(sampler.sampleAtPixel(0, 0)).toEqual({ hueByte: 0, valueByte: 255, alpha: 255 });
    expect(sampler.sampleAtPixel(1, 0)).toEqual({ hueByte: 85, valueByte: 255, alpha: 255 });
    expect(sampler.sampleAtPixel(0, 1)).toEqual({ hueByte: 170, valueByte: 255, alpha: 255 });
    expect(sampler.sampleAtPixel(1, 1)).toEqual({ hueByte: 0, valueByte: 128, alpha: 200 });
  });

  it("rejects out-of-bounds samples", () => {
    const input = makeImageData(
      [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255],
      2,
      2,
    );

    const sampler = makeSampler(input);

    expect(sampler.sampleAtPixel(-1, 0)).toBeNull();
    expect(sampler.sampleAtPixel(2, 1)).toBeNull();
  });

  it("averages pixels in a 3x3 grid by default", () => {
    // Create a 3x3 grid where center is pure red, surrounding pixels are pure green
    const pixels = [
      // Row 0: green, green, green
      0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255,
      // Row 1: green, red, green
      0, 255, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255,
      // Row 2: green, green, green
      0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255,
    ];

    const input = makeImageData(pixels, 3, 3);
    const sampler = makeSampler(input);

    const result = sampler.sampleFromGrid(1, 1);

    expect(result).not.toBeNull();
    expect(result?.hueByte).toBe(76);
    expect(result?.valueByte).toBe(255);
  });

  it("supports variable grid sizes (5x5)", () => {
    const pixels = new Array(5 * 5 * 4).fill(0);
    for (let i = 0; i < 5 * 5; i++) {
      pixels[i * 4] = 255;
      pixels[i * 4 + 1] = 0;
      pixels[i * 4 + 2] = 0;
      pixels[i * 4 + 3] = 255;
    }

    const input = makeImageData(pixels, 5, 5);
    const sampler = makeSampler(input);

    const result = sampler.sampleFromGrid(2, 2, 5);

    expect(result).not.toBeNull();
    expect(result?.hueByte).toBe(0);
    expect(result?.valueByte).toBe(255);
    expect(result?.alpha).toBe(255);
  });

  it("handles edge pixels correctly with grid averaging", () => {
    // Create a 2x2 grid
    const pixels = [
      255,
      0,
      0,
      255, // (0,0) red
      0,
      255,
      0,
      255, // (1,0) green
      0,
      0,
      255,
      255, // (0,1) blue
      255,
      255,
      255,
      255, // (1,1) white
    ];

    const input = makeImageData(pixels, 2, 2);
    const sampler = makeSampler(input);

    // Sample top-left corner with 3x3 grid (only 4 pixels available)
    const result = sampler.sampleFromGrid(0, 0);

    expect(result).not.toBeNull();
    // Should only average the 4 available pixels, not fail
    expect(result?.alpha).toBe(255);
  });

  it("throws error for even grid sizes", () => {
    const input = makeImageData([255, 0, 0, 255], 1, 1);
    const sampler = makeSampler(input);

    expect(() => sampler.sampleFromGrid(0, 0, 4)).toThrow("gridSize must be a positive odd number");
  });

  it("throws error for non-positive grid sizes", () => {
    const input = makeImageData([255, 0, 0, 255], 1, 1);
    const sampler = makeSampler(input);

    expect(() => sampler.sampleFromGrid(0, 0, 0)).toThrow("gridSize must be a positive odd number");
    expect(() => sampler.sampleFromGrid(0, 0, -3)).toThrow(
      "gridSize must be a positive odd number",
    );
  });
});
