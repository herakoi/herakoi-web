/**
 * @vitest-environment happy-dom
 */

import { act, useLayoutEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineConfig, VisualizerFrameData } from "#src/core/plugin";
import { useAppConfigStore } from "#src/state/appConfigStore";
import { useAppRuntimeStore } from "#src/state/appRuntimeStore";
import { useEngineHandles } from "./useEngineHandles";

const { runEngineInitTransactionMock } = vi.hoisted(() => ({
  runEngineInitTransactionMock: vi.fn(),
}));

vi.mock("./engineInitTransaction", () => ({
  runEngineInitTransaction: runEngineInitTransactionMock,
}));

vi.mock("#src/lib/engine/visualizerFrame", () => ({
  initializeAnalyserForVisualizer: vi.fn(),
}));

vi.mock("../ui/canvas", () => ({
  resizeCanvasRefToContainer: vi.fn(),
}));

type HarnessApi = ReturnType<typeof useEngineHandles>;

const HookHarness = ({
  config,
  onReady,
}: {
  config: EngineConfig;
  onReady: (api: HarnessApi) => void;
}) => {
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageOverlayRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const visualizerFrameDataRef = useRef<VisualizerFrameData>({
    detection: { points: [], handDetected: false },
    sampling: { samples: new Map() },
    sonification: { tones: new Map() },
    analyser: null,
  });
  const api = useEngineHandles({
    config,
    refs: { imageCanvasRef, imageOverlayRef },
    analyserRef,
    visualizerFrameDataRef,
  });

  useLayoutEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return (
    <>
      <canvas ref={imageCanvasRef} />
      <canvas ref={imageOverlayRef} />
    </>
  );
};

describe("useEngineHandles", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let previousActFlag: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("disposes only replaced handles when switching one plugin slot", async () => {
    const detectorDisposeA = vi.fn();
    const detectorDisposeB = vi.fn();
    const samplerDisposeA = vi.fn();
    const sonifierDisposeA = vi.fn();

    const handlesA = {
      detectorHandle: {
        detector: {
          initialize: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          points: vi.fn(),
        },
        [Symbol.dispose]: detectorDisposeA,
      },
      samplerHandle: {
        sampler: {
          sampleAt: vi.fn(),
        },
        [Symbol.dispose]: samplerDisposeA,
      },
      sonifierHandle: {
        sonifier: {
          initialize: vi.fn(),
          processSamples: vi.fn(),
          stop: vi.fn(),
          configure: vi.fn(),
        },
        [Symbol.dispose]: sonifierDisposeA,
      },
    };

    const handlesB = {
      detectorHandle: {
        detector: {
          initialize: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          points: vi.fn(),
        },
        [Symbol.dispose]: detectorDisposeB,
      },
      samplerHandle: handlesA.samplerHandle,
      sonifierHandle: handlesA.sonifierHandle,
    };

    runEngineInitTransactionMock.mockImplementation(({ selection }) => {
      if (selection.detection === "detection/b") {
        return Promise.resolve({
          ids: {
            detectionPluginId: "detection/b",
            samplingPluginId: "sampling/a",
            sonificationPluginId: "sonification/a",
          },
          handles: handlesB,
        });
      }
      return Promise.resolve({
        ids: {
          detectionPluginId: "detection/a",
          samplingPluginId: "sampling/a",
          sonificationPluginId: "sonification/a",
        },
        handles: handlesA,
      });
    });

    const config = {
      detection: [],
      sampling: [],
      sonification: [],
      visualization: [],
    } satisfies EngineConfig;

    useAppConfigStore.getState().setActivePlugin("detection", "detection/a" as never);
    useAppConfigStore.getState().setActivePlugin("sampling", "sampling/a" as never);
    useAppConfigStore.getState().setActivePlugin("sonification", "sonification/a" as never);

    let api: HarnessApi | undefined;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <HookHarness
          config={config}
          onReady={(nextApi) => {
            api = nextApi;
          }}
        />,
      );
    });

    await vi.waitFor(() => {
      expect(api?.status).toBe("ready");
      expect(api?.handles).toBe(handlesA);
    });

    await act(async () => {
      useAppConfigStore.getState().setActivePlugin("detection", "detection/b" as never);
    });

    await vi.waitFor(() => {
      expect(api?.status).toBe("ready");
      expect(api?.handles).toBe(handlesB);
    });

    expect(detectorDisposeA).toHaveBeenCalledTimes(1);
    expect(samplerDisposeA).not.toHaveBeenCalled();
    expect(sonifierDisposeA).not.toHaveBeenCalled();
    expect(detectorDisposeB).not.toHaveBeenCalled();
  });
});
