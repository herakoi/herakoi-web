/**
 * @vitest-environment happy-dom
 */

import { act, useCallback, useLayoutEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineConfig } from "#src/core/plugin";
import { useActivePlugin, useAppConfigStore } from "#src/state/appConfigStore";
import { useAppRuntimeStore } from "#src/state/appRuntimeStore";
import type { SonificationEngineStartResult } from "./useSonificationEngine";
import { useSonificationEngine } from "./useSonificationEngine";

type HarnessApi = {
  switchDetectionAndStart: (id: string) => Promise<SonificationEngineStartResult>;
};

type HarnessProps = {
  config: EngineConfig;
  onReady: (api: HarnessApi) => void;
};

const HookHarness = ({ config, onReady }: HarnessProps) => {
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageOverlayRef = useRef<HTMLCanvasElement>(null);
  const { start } = useSonificationEngine(config, { imageCanvasRef, imageOverlayRef });
  const [, setActiveDetectionId] = useActivePlugin("detection");

  const switchDetectionAndStart = useCallback(
    async (id: string) => {
      setActiveDetectionId(id as never);
      return start();
    },
    [setActiveDetectionId, start],
  );

  useLayoutEffect(() => {
    onReady({ switchDetectionAndStart });
  }, [onReady, switchDetectionAndStart]);

  return (
    <>
      <canvas ref={imageCanvasRef} />
      <canvas ref={imageOverlayRef} />
    </>
  );
};

describe("useSonificationEngine plugin switching", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let previousActFlag: unknown;

  beforeEach(() => {
    useAppConfigStore.getState().resetAll();
    useAppRuntimeStore.getState().setStatus({ status: "idle" });
    useAppRuntimeStore.getState().setCurrentUiOpacity(1);
    useAppRuntimeStore.getState().setHasDetectedPoints(false);

    previousActFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown })
      .IS_REACT_ACT_ENVIRONMENT;
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown }).IS_REACT_ACT_ENVIRONMENT =
      previousActFlag;
  });

  it("uses resolved plugin snapshot when switching and starting in the same callback", async () => {
    const createDetectorA = vi.fn(() => ({
      [Symbol.dispose]: vi.fn(),
      detector: {
        initialize: vi.fn().mockResolvedValue(undefined),
        start: vi.fn(),
        stop: vi.fn(),
        onPointsDetected: vi.fn(),
      },
      cleanup: vi.fn(),
    }));
    const createDetectorB = vi.fn(() => ({
      [Symbol.dispose]: vi.fn(),
      detector: {
        initialize: vi.fn().mockResolvedValue(undefined),
        start: vi.fn(),
        stop: vi.fn(),
        onPointsDetected: vi.fn(),
      },
      cleanup: vi.fn(),
    }));

    const config = {
      detection: [
        {
          kind: "detection",
          id: "detection/a",
          displayName: "Detection A",
          settingsTab: null,
          ui: {},
          config: { defaultConfig: {} },
          createDetector: createDetectorA,
        },
        {
          kind: "detection",
          id: "detection/b",
          displayName: "Detection B",
          settingsTab: null,
          ui: {},
          config: { defaultConfig: {} },
          createDetector: createDetectorB,
        },
      ],
      sampling: [
        {
          kind: "sampling",
          id: "sampling/a",
          displayName: "Sampling A",
          settingsTab: null,
          ui: {},
          config: { defaultConfig: {} },
          createSampler: vi.fn(() => ({
            [Symbol.dispose]: vi.fn(),
            sampler: {
              loadImage: vi.fn().mockResolvedValue(undefined),
              sampleAt: vi.fn(() => new Map()),
            },
            postInitialize: vi.fn().mockResolvedValue(undefined),
            cleanup: vi.fn(),
          })),
        },
      ],
      sonification: [
        {
          kind: "sonification",
          id: "sonification/a",
          displayName: "Sonification A",
          settingsTab: null,
          ui: {},
          config: { defaultConfig: {} },
          createSonifier: vi.fn(() => ({
            [Symbol.dispose]: vi.fn(),
            sonifier: {
              initialize: vi.fn().mockResolvedValue(undefined),
              processSamples: vi.fn(),
              stop: vi.fn(),
              configure: vi.fn(),
            },
            cleanup: vi.fn(),
          })),
        },
      ],
      visualization: [],
    } satisfies EngineConfig;

    const { setActivePlugin } = useAppConfigStore.getState();
    setActivePlugin("detection", "detection/a" as never);
    setActivePlugin("sampling", "sampling/a" as never);
    setActivePlugin("sonification", "sonification/a" as never);

    let api: HarnessApi | undefined;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <HookHarness
          config={config}
          onReady={(harnessApi) => {
            api = harnessApi;
          }}
        />,
      );
    });

    const harnessApi = api;
    if (!harnessApi) {
      throw new Error("Harness API not initialized");
    }

    let startResult: SonificationEngineStartResult = new Error("Start result not set");
    await act(async () => {
      startResult = await harnessApi.switchDetectionAndStart("detection/b");
    });

    expect(createDetectorA).toHaveBeenCalledTimes(1);
    expect(createDetectorB).not.toHaveBeenCalled();
    expect(startResult).not.toBeInstanceOf(Error);
    expect(startResult).toEqual(
      expect.objectContaining({
        status: "running",
        data: expect.objectContaining({ detectionPluginId: "detection/a" }),
      }),
    );
  });
});
