import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineConfig } from "#src/core/plugin";
import type { EngineSnapshot } from "./engineHandles.types";
import { runEngineInitTransaction } from "./engineInitTransaction";

const makeDetectorHandle = (label: string, options?: { startError?: Error }) => {
  const dispose = vi.fn();
  return {
    label,
    handle: {
      detector: {
        initialize: vi.fn().mockResolvedValue(undefined),
        start: options?.startError ? vi.fn().mockResolvedValue(options.startError) : vi.fn(),
        stop: vi.fn(),
        points: vi.fn(),
      },
      postInitialize: vi.fn(),
      setCanvasRefs: vi.fn(),
      [Symbol.dispose]: dispose,
    },
    dispose,
  };
};

const makeSamplerHandle = (label: string) => {
  const dispose = vi.fn();
  return {
    label,
    handle: {
      sampler: {
        loadImage: vi.fn().mockResolvedValue(undefined),
        sampleAt: vi.fn(),
      },
      postInitialize: vi.fn().mockResolvedValue(undefined),
      setCanvasRefs: vi.fn(),
      [Symbol.dispose]: dispose,
    },
    dispose,
  };
};

const makeSonifierHandle = (label: string) => {
  const dispose = vi.fn();
  return {
    label,
    handle: {
      sonifier: {
        initialize: vi.fn().mockResolvedValue(undefined),
        processSamples: vi.fn(),
        stop: vi.fn(),
        configure: vi.fn(),
      },
      [Symbol.dispose]: dispose,
    },
    dispose,
  };
};

describe("runEngineInitTransaction selective reuse", () => {
  const detectorA = makeDetectorHandle("detector/a");
  const detectorB = makeDetectorHandle("detector/b");
  const detectorBroken = makeDetectorHandle("detector/broken", {
    startError: new Error("detector start failed"),
  });
  const samplerA = makeSamplerHandle("sampling/a");
  const sonifierA = makeSonifierHandle("sonification/a");

  const config = {
    detection: [
      {
        kind: "detection",
        id: "detector/a",
        displayName: "Detector A",
        ui: {},
        config: { defaultConfig: {} },
        createDetector: vi.fn(() => detectorA.handle),
      },
      {
        kind: "detection",
        id: "detector/b",
        displayName: "Detector B",
        ui: {},
        config: { defaultConfig: {} },
        createDetector: vi.fn(() => detectorB.handle),
      },
      {
        kind: "detection",
        id: "detector/broken",
        displayName: "Detector Broken",
        ui: {},
        config: { defaultConfig: {} },
        createDetector: vi.fn(() => detectorBroken.handle),
      },
    ],
    sampling: [
      {
        kind: "sampling",
        id: "sampling/a",
        displayName: "Sampling A",
        ui: {},
        config: { defaultConfig: {} },
        createSampler: vi.fn(() => samplerA.handle),
      },
    ],
    sonification: [
      {
        kind: "sonification",
        id: "sonification/a",
        displayName: "Sonification A",
        ui: {},
        config: { defaultConfig: {} },
        createSonifier: vi.fn(() => sonifierA.handle),
      },
    ],
    visualization: [],
  } satisfies EngineConfig;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recreates only changed slot and reuses others", async () => {
    const first = await runEngineInitTransaction({
      selection: {
        detection: "detector/a",
        sampling: "sampling/a",
        sonification: "sonification/a",
      },
      signal: new AbortController().signal,
      config,
      snapshot: { ids: null, handles: null },
      pluginConfigs: {},
      imageCanvasRef: { current: null },
      imageOverlayRef: { current: null },
    });
    if (first instanceof Error) throw first;

    const second = await runEngineInitTransaction({
      selection: {
        detection: "detector/b",
        sampling: "sampling/a",
        sonification: "sonification/a",
      },
      signal: new AbortController().signal,
      config,
      snapshot: first as EngineSnapshot,
      pluginConfigs: {},
      imageCanvasRef: { current: null },
      imageOverlayRef: { current: null },
    });
    if (second instanceof Error) throw second;

    expect(config.detection[0].createDetector).toHaveBeenCalledTimes(1);
    expect(config.detection[1].createDetector).toHaveBeenCalledTimes(1);
    expect(config.sampling[0].createSampler).toHaveBeenCalledTimes(1);
    expect(config.sonification[0].createSonifier).toHaveBeenCalledTimes(1);

    expect(second.handles.detectorHandle).toBe(detectorB.handle);
    expect(second.handles.samplerHandle).toBe(samplerA.handle);
    expect(second.handles.sonifierHandle).toBe(sonifierA.handle);

    expect(samplerA.handle.postInitialize).toHaveBeenCalledTimes(1);
    expect(sonifierA.handle.sonifier.initialize).toHaveBeenCalledTimes(1);
    expect(detectorA.handle.detector.initialize).toHaveBeenCalledTimes(1);
    expect(detectorB.handle.detector.initialize).toHaveBeenCalledTimes(1);
  });

  it("disposes only newly created handles on failed switch", async () => {
    const initial = await runEngineInitTransaction({
      selection: {
        detection: "detector/a",
        sampling: "sampling/a",
        sonification: "sonification/a",
      },
      signal: new AbortController().signal,
      config,
      snapshot: { ids: null, handles: null },
      pluginConfigs: {},
      imageCanvasRef: { current: null },
      imageOverlayRef: { current: null },
    });
    if (initial instanceof Error) throw initial;

    const failed = await runEngineInitTransaction({
      selection: {
        detection: "detector/broken",
        sampling: "sampling/a",
        sonification: "sonification/a",
      },
      signal: new AbortController().signal,
      config,
      snapshot: initial as EngineSnapshot,
      pluginConfigs: {},
      imageCanvasRef: { current: null },
      imageOverlayRef: { current: null },
    });

    expect(failed).toBeInstanceOf(Error);
    expect(detectorBroken.dispose).toHaveBeenCalledTimes(1);
    expect(samplerA.dispose).not.toHaveBeenCalled();
    expect(sonifierA.dispose).not.toHaveBeenCalled();
  });
});
