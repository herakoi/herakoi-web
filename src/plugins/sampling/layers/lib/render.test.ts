import { describe, expect, it } from "vitest";
import type { LayerCube } from "./cube";
import {
  computeLayerPixels,
  createLayerScales,
  defaultLayerMapping,
  NO_LAYER,
  sanitizeLayerMapping,
} from "./render";

const cubeOf = (layers: number[][], range?: { low: number; high: number }): LayerCube => ({
  width: layers[0].length,
  height: 1,
  sourceWidth: layers[0].length,
  sourceHeight: 1,
  layers: layers.map((values, index) => ({
    name: `L${index}`,
    data: Float32Array.from(values),
    range,
  })),
});

describe("layer mapping", () => {
  it("defaults to RGB from the first three layers, grey for fewer", () => {
    expect(defaultLayerMapping(4)).toEqual({ mode: "rgb", channels: [0, 1, 2], stretch: "linear" });
    expect(defaultLayerMapping(1).channels).toEqual([0, 0, 0]);
  });

  it("drops layer indices that no longer exist", () => {
    expect(sanitizeLayerMapping({ mode: "hsv", channels: [0, 5, 1], stretch: "log" }, 2)).toEqual({
      mode: "hsv",
      channels: [0, NO_LAYER, 1],
      stretch: "log",
    });
  });
});

describe("layer scales", () => {
  it("uses a fixed range when the layer has one and keeps NaN as no data", () => {
    const cube = cubeOf([[0, 127.5, 255, Number.NaN]], { low: 0, high: 255 });
    const [scale] = createLayerScales(cube, "linear");
    expect(scale(0)).toBe(0);
    expect(scale(127.5)).toBeCloseTo(0.5);
    expect(scale(255)).toBe(1);
    expect(Number.isNaN(scale(Number.NaN))).toBe(true);
  });

  it("clips to the percentile range without a fixed range", () => {
    const values = Array.from({ length: 1000 }, (_, i) => i);
    const [scale] = createLayerScales(cubeOf([values]), "linear");
    expect(scale(-50)).toBe(0);
    expect(scale(5000)).toBe(1);
  });
});

describe("computeLayerPixels", () => {
  it("uses layers as hue/saturation/value in HSV mode, keeping hue where saturation is 0", () => {
    const cube = cubeOf(
      [
        [0, 1],
        [0, 0],
        [1, 1],
      ],
      { low: 0, high: 1 },
    );
    const mapping = {
      mode: "hsv" as const,
      channels: [0, 1, 2] as [number, number, number],
      stretch: "linear" as const,
    };
    const pixels = computeLayerPixels(cube, mapping, createLayerScales(cube, "linear"));
    expect(pixels.hsv[4]).toBe(255);
    expect(pixels.hsv[5]).toBe(0);
    expect(pixels.display[4]).toBe(pixels.display[5]);
  });

  it("derives HSV from RGB layers and marks pixels without colour data", () => {
    const cube = cubeOf(
      [
        [255, Number.NaN],
        [0, 0],
        [0, 0],
      ],
      { low: 0, high: 255 },
    );
    const pixels = computeLayerPixels(
      cube,
      defaultLayerMapping(3),
      createLayerScales(cube, "linear"),
    );
    expect(Array.from(pixels.display.slice(0, 4))).toEqual([255, 0, 0, 255]);
    expect(Array.from(pixels.hsv.slice(0, 4))).toEqual([0, 255, 255, 255]);
    expect(pixels.hsv[7]).toBe(0);
    expect(Array.from(pixels.display.slice(4, 8))).toEqual([0, 0, 0, 255]);
  });
});
