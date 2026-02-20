/**
 * @vitest-environment happy-dom
 */

import { act, useCallback, useLayoutEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PipelineConfig } from "#src/core/plugin";
import { useActivePlugin, useAppConfigStore } from "#src/state/appConfigStore";
import { useAppRuntimeStore } from "#src/state/appRuntimeStore";
import { useSonificationEngine } from "./useSonificationEngine";

type HarnessApi = {
  switchDetectionAndStart: (id: string) => Promise<void>;
};

type HarnessProps = {
  config: PipelineConfig;
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
      await start();
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

  it("uses latest detection plugin id when switching and starting in the same callback", async () => {
    const createDetectorA = vi.fn(() => ({
      detector: {
        initialize: vi.fn().mockResolvedValue(undefined),
        start: vi.fn(),
        stop: vi.fn(),
        onPointsDetected: vi.fn(),
      },
      cleanup: vi.fn(),
    }));
    const createDetectorB = vi.fn(() => ({
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
          bindPipelineEvents: vi.fn(),
        },
        {
          kind: "detection",
          id: "detection/b",
          displayName: "Detection B",
          settingsTab: null,
          ui: {},
          config: { defaultConfig: {} },
          createDetector: createDetectorB,
          bindPipelineEvents: vi.fn(),
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
            sampler: {
              loadImage: vi.fn().mockResolvedValue(undefined),
              sampleAt: vi.fn(() => null),
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
    } satisfies PipelineConfig;

    const { setActivePlugin } = useAppConfigStore.getState();
    setActivePlugin("detection", "detection/a" as never);
    setActivePlugin("sampling", "sampling/a" as never);
    setActivePlugin("sonification", "sonification/a" as never);

    let api: HarnessApi | null = null;
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

    if (!api) {
      throw new Error("Harness API not initialized");
    }

    await act(async () => {
      await api?.switchDetectionAndStart("detection/b");
    });

    expect(createDetectorB).toHaveBeenCalledTimes(1);
    expect(createDetectorA).not.toHaveBeenCalled();
  });
});
