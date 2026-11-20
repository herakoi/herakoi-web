import { describe, expect, it } from "vitest";
import { decimationStride, MAX_LAYER_SIDE, rgbaToCube } from "./cube";

describe("rgbaToCube", () => {
  it("splits RGBA into red, green and blue layers with a 0–255 range", () => {
    const cube = rgbaToCube(Uint8ClampedArray.from([10, 20, 30, 255, 1, 2, 3, 0]), 2, 1);
    expect(cube.layers.map((layer) => layer.name)).toEqual(["Red", "Green", "Blue"]);
    expect(cube.layers[1].data[0]).toBe(20);
    expect(cube.layers[0].range).toEqual({ low: 0, high: 255 });
    // Transparent pixels have no data.
    expect(Number.isNaN(cube.layers[2].data[1])).toBe(true);
  });
});

describe("decimationStride", () => {
  it("keeps small images whole and shrinks large ones", () => {
    expect(decimationStride(800, 600, 4)).toBe(1);
    expect(decimationStride(MAX_LAYER_SIDE * 2, 100, 1)).toBe(2);
  });
});
