import { describe, expect, it, vi } from "vitest";

import { ApplicationController } from "#src/core/ApplicationController";
import type { DetectedPoint, ImageSample } from "#src/core/interfaces";

const makePoint = (id: string, x = 0.5, y = 0.5): DetectedPoint => ({ id, x, y });
const makeSample = (value: number): ImageSample => ({ data: { valueByte: value } });

describe("ApplicationController", () => {
  it("wires detector → sampler → sonifier", async () => {
    const detectorCallbacks: ((points: DetectedPoint[]) => void)[] = [];

    const detector = {
      initialize: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(),
      stop: vi.fn(),
      onPointsDetected: vi.fn((cb: (points: DetectedPoint[]) => void) => {
        detectorCallbacks.push(cb);
      }),
    };

    const sampler = {
      loadImage: vi.fn(),
      sampleAt: vi.fn((point: DetectedPoint) => makeSample(point.x * 255)),
    };

    const sonifier = {
      initialize: vi.fn().mockResolvedValue(undefined),
      processSamples: vi.fn(),
      stop: vi.fn(),
      configure: vi.fn(),
    };

    const controller = new ApplicationController(detector, sampler, sonifier);

    await controller.start();

    expect(detector.initialize).toHaveBeenCalled();
    expect(sonifier.initialize).toHaveBeenCalled();
    expect(detector.start).toHaveBeenCalled();

    const points = [makePoint("a", 0.1, 0.2), makePoint("b", 0.9, 0.8)];
    for (const cb of detectorCallbacks) {
      cb(points);
    }

    expect(sampler.sampleAt).toHaveBeenCalledTimes(points.length);
    expect(sonifier.processSamples).toHaveBeenCalledWith(
      expect.any(Map) as Map<string, ImageSample>,
    );
  });

  it("stops detector and sonifier", async () => {
    const detector = {
      initialize: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(),
      stop: vi.fn(),
      onPointsDetected: vi.fn(),
    };

    const sampler = {
      loadImage: vi.fn(),
      sampleAt: vi.fn().mockReturnValue(makeSample(0)),
    };

    const sonifier = {
      initialize: vi.fn().mockResolvedValue(undefined),
      processSamples: vi.fn(),
      stop: vi.fn(),
      configure: vi.fn(),
    };

    const controller = new ApplicationController(detector, sampler, sonifier);
    await controller.start();
    await controller.stop();

    expect(detector.stop).toHaveBeenCalled();
    expect(sonifier.stop).toHaveBeenCalled();
  });
});
