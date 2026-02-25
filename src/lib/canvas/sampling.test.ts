import { describe, expect, it, vi } from "vitest";
import type { ImageSample } from "#src/core/interfaces";
import {
  buildSamplesForDetectedPoints,
  isPointInsideVisibleRect,
  mapPointToCanvasSpace,
} from "./sampling";

describe("canvas sampling utils", () => {
  it("maps point from source space to canvas cover space", () => {
    const mapped = mapPointToCanvasSpace(
      { id: "p1", x: 0.5, y: 0.5 },
      { width: 4, height: 3 },
      { width: 16, height: 9 },
    );

    expect(mapped.x).toBeCloseTo(0.5, 5);
    expect(mapped.y).toBeCloseTo(0.5, 5);
  });

  it("returns original coordinates when source or canvas size is not valid", () => {
    const mapped = mapPointToCanvasSpace({ id: "p1", x: 0.3, y: 0.7 }, null, {
      width: 0,
      height: 0,
    });

    expect(mapped).toEqual({ x: 0.3, y: 0.7 });
  });

  it("checks point inclusion against visible rect", () => {
    const canvasSize = { width: 100, height: 100 };
    const visibleRect = { x: 20, y: 20, width: 40, height: 40 };

    expect(isPointInsideVisibleRect({ x: 0.3, y: 0.3 }, visibleRect, canvasSize)).toBe(true);
    expect(isPointInsideVisibleRect({ x: 0.9, y: 0.9 }, visibleRect, canvasSize)).toBe(false);
  });

  it("builds samples with mapping/filtering and ignores null/error samples", () => {
    const onSampleError = vi.fn();
    const sampleAt: (point: { id: string; x: number; y: number }) => ImageSample | null | Error =
      vi.fn((point: { id: string; x: number; y: number }) => {
        if (point.id === "inside-1") return { data: { hue: 100 } };
        if (point.id === "inside-2") return new Error("boom");
        return null;
      });

    const samples = buildSamplesForDetectedPoints({
      points: [
        { id: "inside-1", x: 0.5, y: 0.5 },
        { id: "inside-2", x: 0.4, y: 0.4 },
        { id: "outside", x: 0.95, y: 0.95 },
      ],
      sourceSize: undefined,
      visibleRect: { x: 0, y: 0, width: 80, height: 80 },
      canvasSize: { width: 100, height: 100 },
      sampleAt,
      onSampleError,
    });

    expect(sampleAt).toHaveBeenCalledTimes(2);
    expect(samples.size).toBe(1);
    expect(samples.get("inside-1")).toEqual({ data: { hue: 100 } });
    expect(onSampleError).toHaveBeenCalledTimes(1);
  });
});
