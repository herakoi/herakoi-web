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
});
