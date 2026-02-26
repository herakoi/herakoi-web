import { describe, expect, it, vi } from "vitest";
import { DetectionInitializeError, PluginCreationError } from "#src/core/domain-errors";
import type { ResolvedEnginePlugins } from "./startup";
import { createEngineHandles, initializeEnginePlugins } from "./startup";

describe("createEngineHandles", () => {
  it("disposes handles already created when one plugin handle creation fails", async () => {
    const detectorDispose = vi.fn();
    const samplerDispose = vi.fn();

    const resolved = {
      detection: {
        id: "detection/a",
        plugin: {
          kind: "detection",
          id: "detection/a",
          displayName: "Detection A",
          ui: {},
          config: { defaultConfig: {} },
          createDetector: vi.fn(() => ({
            [Symbol.dispose]: detectorDispose,
            detector: {
              initialize: vi.fn().mockResolvedValue(undefined),
              start: vi.fn().mockResolvedValue(undefined),
              stop: vi.fn(),
              onPointsDetected: vi.fn(),
            },
          })),
        },
        config: {},
        runtime: {} as never,
      },
      sampling: {
        id: "sampling/a",
        plugin: {
          kind: "sampling",
          id: "sampling/a",
          displayName: "Sampling A",
          ui: {},
          config: { defaultConfig: {} },
          createSampler: vi.fn(() => ({
            [Symbol.dispose]: samplerDispose,
            sampler: {
              loadImage: vi.fn().mockResolvedValue(undefined),
              sampleAt: vi.fn(() => new Map()),
            },
          })),
        },
        config: {},
        runtime: {} as never,
      },
      sonification: {
        id: "sonification/a",
        plugin: {
          kind: "sonification",
          id: "sonification/a",
          displayName: "Sonification A",
          ui: {},
          config: { defaultConfig: {} },
          createSonifier: vi.fn(() => new Error("sonifier failed")),
        },
        config: {},
        runtime: {} as never,
      },
    } satisfies ResolvedEnginePlugins;

    const result = await createEngineHandles(resolved);

    expect(result).toBeInstanceOf(PluginCreationError);
    expect(detectorDispose).toHaveBeenCalledTimes(1);
    expect(samplerDispose).toHaveBeenCalledTimes(1);
  });
});

describe("initializeEnginePlugins", () => {
  it("normalizes thrown detector initialize errors into DetectionInitializeError", async () => {
    const result = initializeEnginePlugins({
      detectorHandle: {
        [Symbol.dispose]: vi.fn(),
        detector: {
          initialize: vi.fn().mockRejectedValue(new Error("detector blew up")),
          start: vi.fn().mockResolvedValue(undefined),
          stop: vi.fn(),
          onPointsDetected: vi.fn(),
        },
      },
      samplerHandle: {
        [Symbol.dispose]: vi.fn(),
        sampler: {
          loadImage: vi.fn().mockResolvedValue(undefined),
          sampleAt: vi.fn(() => new Map()),
        },
      },
      sonifierHandle: {
        [Symbol.dispose]: vi.fn(),
        sonifier: {
          initialize: vi.fn().mockResolvedValue(undefined),
          processSamples: vi.fn(),
          stop: vi.fn(),
          configure: vi.fn(),
        },
      },
      imageOverlayRef: { current: null },
      imageCanvasRef: { current: null },
    });

    await expect(result).resolves.toBeInstanceOf(DetectionInitializeError);
  });
});
