import { describe, expect, it } from "vitest";
import { channelsForCube, LayerImageSampler } from "./LayerImageSampler";
import type { LayerCube } from "./lib/cube";
import { computeLayerPixels, createLayerScales, defaultLayerMapping } from "./lib/render";

// 2x1 image: red/green/blue at 0–255, plus a float layer with a blank second pixel.
const cube: LayerCube = {
  width: 2,
  height: 1,
  sourceWidth: 2,
  sourceHeight: 1,
  layers: [
    { name: "Red", data: Float32Array.from([255, 0]), range: { low: 0, high: 255 } },
    { name: "Green", data: Float32Array.from([0, 0]), range: { low: 0, high: 255 } },
    { name: "Blue", data: Float32Array.from([0, 255]), range: { low: 0, high: 255 } },
    { name: "VELOCITY", data: Float32Array.from([5, Number.NaN]), range: { low: 0, high: 10 } },
  ],
};

const makeSampler = (rotation = 0) => {
  const mapping = defaultLayerMapping(cube.layers.length);
  const scales = createLayerScales(cube, mapping.stretch);
  const { hsv } = computeLayerPixels(cube, mapping, scales);
  const sampler = new LayerImageSampler();
  sampler.setImage(cube, {
    mapping,
    scales,
    hsv,
    display: {} as HTMLCanvasElement,
  });
  // Image drawn 100x50 in the middle of a 101x51 canvas.
  sampler.setView(
    {
      centerX: 50,
      centerY: 25,
      drawWidth: 100,
      drawHeight: 50,
      rotation,
      imageWidth: 2,
      imageHeight: 1,
    },
    101,
    51,
  );
  return sampler;
};

describe("LayerImageSampler", () => {
  it("returns HSV bytes and every layer scaled to 0–1", () => {
    const result = makeSampler().sampleAt([{ id: "left", x: 0.1, y: 0.5 }]);
    if (result instanceof Error) throw result;
    expect(result.get("left")?.data).toEqual({
      hueByte: 0,
      saturationByte: 255,
      valueByte: 255,
      alpha: 255,
      "layer.0": 1,
      "layer.1": 0,
      "layer.2": 0,
      "layer.3": 0.5,
    });
  });

  it("leaves out layers without data at the point", () => {
    const result = makeSampler().sampleAt([{ id: "right", x: 0.9, y: 0.5 }]);
    if (result instanceof Error) throw result;
    expect(result.get("right")?.data).not.toHaveProperty("layer.3");
    // The nearest VELOCITY data is one pixel to the left, in a 2-pixel-wide image.
    expect(result.get("right")?.data["layer.3:distance"]).toBe(0.5);
    expect(result.get("right")?.data["layer.2"]).toBe(1);
  });

  it("follows the rotation of the drawn image", () => {
    // Rotated by 180°: the left of the canvas shows the right pixel of the image.
    const result = makeSampler(Math.PI).sampleAt([{ id: "left", x: 0.1, y: 0.5 }]);
    if (result instanceof Error) throw result;
    expect(result.get("left")?.data["layer.2"]).toBe(1);
  });

  it("gives no sample outside the image", () => {
    const sampler = makeSampler();
    sampler.setView(
      {
        centerX: 50,
        centerY: 25,
        drawWidth: 20,
        drawHeight: 10,
        rotation: 0,
        imageWidth: 2,
        imageHeight: 1,
      },
      101,
      51,
    );
    const result = sampler.sampleAt([{ id: "corner", x: 0, y: 0 }]);
    if (result instanceof Error) throw result;
    expect(result.size).toBe(0);
  });

  it("lists hue/saturation/value and one channel per layer", () => {
    const channels = channelsForCube(cube);
    expect(channels.at(-1)?.distanceKey).toBe("layer.3:distance");
    const keys = channels.map((channel) => channel.key);
    expect(keys).toEqual([
      "hueByte",
      "saturationByte",
      "valueByte",
      "layer.0",
      "layer.1",
      "layer.2",
      "layer.3",
    ]);
  });
});
