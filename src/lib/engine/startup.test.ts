import { describe, expect, it, vi } from "vitest";
import { PluginCreationError } from "#src/core/domain-errors";
import type { ResolvedEnginePlugins } from "./startup";
import { createEngineHandles } from "./startup";

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
          settingsTab: null,
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
          settingsTab: null,
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
          settingsTab: null,
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
