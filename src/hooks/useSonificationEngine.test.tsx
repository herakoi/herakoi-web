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
  startTransport: () => Promise<SonificationEngineStartResult>;
  stopTransport: () => void;
  switchDetectionAndStart: (id: string) => Promise<SonificationEngineStartResult>;
  switchSamplingAndStart: (id: string) => Promise<SonificationEngineStartResult>;
  switchSonificationAndStart: (id: string) => Promise<SonificationEngineStartResult>;
};

type HarnessProps = {
  config: EngineConfig;
  onReady: (api: HarnessApi) => void;
};

const startTransportWhenReady = async (
  startTransport: () => Promise<SonificationEngineStartResult>,
): Promise<SonificationEngineStartResult> => {
  let lastResult: SonificationEngineStartResult = new Error("Engine not ready");
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await act(async () => {
      lastResult = await startTransport();
    });
    if (!(lastResult instanceof Error)) {
      return lastResult;
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  throw new Error("Engine did not become ready in time.");
};

const createPointStreamController = () => {
  const subscribers = new Set<(points: Array<{ id: string; x: number; y: number }>) => void>();
  return {
    points: (signal?: AbortSignal): AsyncIterable<Array<{ id: string; x: number; y: number }>> => ({
      [Symbol.asyncIterator]() {
        const queue: Array<Array<{ id: string; x: number; y: number }>> = [];
        let waiting:
          | ((value: IteratorResult<Array<{ id: string; x: number; y: number }>>) => void)
          | null = null;
        let done = false;

        const close = () => {
          if (done) return;
          done = true;
          subscribers.delete(push);
          if (waiting) {
            const resolve = waiting;
            waiting = null;
            resolve({ value: undefined, done: true });
          }
        };

        const push = (points: Array<{ id: string; x: number; y: number }>) => {
          if (done) return;
          if (waiting) {
            const resolve = waiting;
            waiting = null;
            resolve({ value: points, done: false });
            return;
          }
          queue.push(points);
        };

        subscribers.add(push);
        if (signal) {
          if (signal.aborted) {
            close();
          } else {
            signal.addEventListener("abort", close, { once: true });
          }
        }

        return {
          next: async () => {
            if (done) return { value: undefined, done: true };
            const value = queue.shift();
            if (value) return { value, done: false };
            return new Promise<IteratorResult<Array<{ id: string; x: number; y: number }>>>(
              (resolve) => {
                waiting = resolve;
              },
            );
          },
          return: async () => {
            close();
            return { value: undefined, done: true };
          },
        };
      },
    }),
    emit: (points: Array<{ id: string; x: number; y: number }>) => {
      for (const subscriber of subscribers) {
        subscriber(points);
      }
    },
  };
};

const HookHarness = ({ config, onReady }: HarnessProps) => {
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageOverlayRef = useRef<HTMLCanvasElement>(null);
  const { startTransport, stopTransport } = useSonificationEngine(config, {
    imageCanvasRef,
    imageOverlayRef,
  });
  const [, setActiveDetectionId] = useActivePlugin("detection");
  const [, setActiveSamplingId] = useActivePlugin("sampling");
  const [, setActiveSonificationId] = useActivePlugin("sonification");

  const switchDetectionAndStart = useCallback(
    async (id: string) => {
      setActiveDetectionId(id as never);
      return startTransport();
    },
    [setActiveDetectionId, startTransport],
  );

  const switchSamplingAndStart = useCallback(
    async (id: string) => {
      setActiveSamplingId(id as never);
      return startTransport();
    },
    [setActiveSamplingId, startTransport],
  );

  const switchSonificationAndStart = useCallback(
    async (id: string) => {
      setActiveSonificationId(id as never);
      return startTransport();
    },
    [setActiveSonificationId, startTransport],
  );

  useLayoutEffect(() => {
    onReady({
      startTransport,
      stopTransport,
      switchDetectionAndStart,
      switchSamplingAndStart,
      switchSonificationAndStart,
    });
  }, [
    onReady,
    startTransport,
    stopTransport,
    switchDetectionAndStart,
    switchSamplingAndStart,
    switchSonificationAndStart,
  ]);

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

  it("starts with the newly selected plugin when switching and starting in the same callback", async () => {
    const streamA = createPointStreamController();
    const streamB = createPointStreamController();
    const createDetectorA = vi.fn(() => ({
      [Symbol.dispose]: vi.fn(),
      detector: {
        initialize: vi.fn().mockResolvedValue(undefined),
        start: vi.fn(),
        stop: vi.fn(),
        points: vi.fn((signal?: AbortSignal) => streamA.points(signal)),
      },
      cleanup: vi.fn(),
    }));
    const createDetectorB = vi.fn(() => ({
      [Symbol.dispose]: vi.fn(),
      detector: {
        initialize: vi.fn().mockResolvedValue(undefined),
        start: vi.fn(),
        stop: vi.fn(),
        points: vi.fn((signal?: AbortSignal) => streamB.points(signal)),
      },
      cleanup: vi.fn(),
    }));
    const createSampler = vi.fn(() => ({
      [Symbol.dispose]: vi.fn(),
      sampler: {
        loadImage: vi.fn().mockResolvedValue(undefined),
        sampleAt: vi.fn(() => new Map()),
      },
      postInitialize: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn(),
    }));
    const createSonifier = vi.fn(() => ({
      [Symbol.dispose]: vi.fn(),
      sonifier: {
        initialize: vi.fn().mockResolvedValue(undefined),
        processSamples: vi.fn(),
        stop: vi.fn(),
        configure: vi.fn(),
      },
      cleanup: vi.fn(),
    }));

    const config = {
      detection: [
        {
          kind: "detection",
          id: "detection/a",
          displayName: "Detection A",
          ui: {},
          config: { defaultConfig: {} },
          createDetector: createDetectorA,
        },
        {
          kind: "detection",
          id: "detection/b",
          displayName: "Detection B",
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
          ui: {},
          config: { defaultConfig: {} },
          createSampler,
        },
      ],
      sonification: [
        {
          kind: "sonification",
          id: "sonification/a",
          displayName: "Sonification A",
          ui: {},
          config: { defaultConfig: {} },
          createSonifier,
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
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createDetectorA).toHaveBeenCalledTimes(1);
    expect(createDetectorB).toHaveBeenCalledTimes(1);
    expect(createSampler).toHaveBeenCalledTimes(1);
    expect(createSonifier).toHaveBeenCalledTimes(1);
    expect(startResult).toBeDefined();
  });

  it("recreates only sampling when switching sampling plugin", async () => {
    const stream = createPointStreamController();
    const createDetector = vi.fn(() => ({
      [Symbol.dispose]: vi.fn(),
      detector: {
        initialize: vi.fn().mockResolvedValue(undefined),
        start: vi.fn(),
        stop: vi.fn(),
        points: vi.fn((signal?: AbortSignal) => stream.points(signal)),
      },
      cleanup: vi.fn(),
    }));
    const createSamplerA = vi.fn(() => ({
      [Symbol.dispose]: vi.fn(),
      sampler: {
        loadImage: vi.fn().mockResolvedValue(undefined),
        sampleAt: vi.fn(() => new Map()),
      },
      postInitialize: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn(),
    }));
    const createSamplerB = vi.fn(() => ({
      [Symbol.dispose]: vi.fn(),
      sampler: {
        loadImage: vi.fn().mockResolvedValue(undefined),
        sampleAt: vi.fn(() => new Map()),
      },
      postInitialize: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn(),
    }));
    const createSonifier = vi.fn(() => ({
      [Symbol.dispose]: vi.fn(),
      sonifier: {
        initialize: vi.fn().mockResolvedValue(undefined),
        processSamples: vi.fn(),
        stop: vi.fn(),
        configure: vi.fn(),
      },
      cleanup: vi.fn(),
    }));

    const config = {
      detection: [
        {
          kind: "detection",
          id: "detection/a",
          displayName: "Detection A",
          ui: {},
          config: { defaultConfig: {} },
          createDetector,
        },
      ],
      sampling: [
        {
          kind: "sampling",
          id: "sampling/a",
          displayName: "Sampling A",
          ui: {},
          config: { defaultConfig: {} },
          createSampler: createSamplerA,
        },
        {
          kind: "sampling",
          id: "sampling/b",
          displayName: "Sampling B",
          ui: {},
          config: { defaultConfig: {} },
          createSampler: createSamplerB,
        },
      ],
      sonification: [
        {
          kind: "sonification",
          id: "sonification/a",
          displayName: "Sonification A",
          ui: {},
          config: { defaultConfig: {} },
          createSonifier,
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
    if (!harnessApi) throw new Error("Harness API not initialized");

    await act(async () => {
      await harnessApi.switchSamplingAndStart("sampling/b");
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createDetector).toHaveBeenCalledTimes(1);
    expect(createSamplerA).toHaveBeenCalledTimes(1);
    expect(createSamplerB).toHaveBeenCalledTimes(1);
    expect(createSonifier).toHaveBeenCalledTimes(1);
  });

  it("recreates only sonification when switching sonification plugin", async () => {
    const stream = createPointStreamController();
    const createDetector = vi.fn(() => ({
      [Symbol.dispose]: vi.fn(),
      detector: {
        initialize: vi.fn().mockResolvedValue(undefined),
        start: vi.fn(),
        stop: vi.fn(),
        points: vi.fn((signal?: AbortSignal) => stream.points(signal)),
      },
      cleanup: vi.fn(),
    }));
    const createSampler = vi.fn(() => ({
      [Symbol.dispose]: vi.fn(),
      sampler: {
        loadImage: vi.fn().mockResolvedValue(undefined),
        sampleAt: vi.fn(() => new Map()),
      },
      postInitialize: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn(),
    }));
    const createSonifierA = vi.fn(() => ({
      [Symbol.dispose]: vi.fn(),
      sonifier: {
        initialize: vi.fn().mockResolvedValue(undefined),
        processSamples: vi.fn(),
        stop: vi.fn(),
        configure: vi.fn(),
      },
      cleanup: vi.fn(),
    }));
    const createSonifierB = vi.fn(() => ({
      [Symbol.dispose]: vi.fn(),
      sonifier: {
        initialize: vi.fn().mockResolvedValue(undefined),
        processSamples: vi.fn(),
        stop: vi.fn(),
        configure: vi.fn(),
      },
      cleanup: vi.fn(),
    }));

    const config = {
      detection: [
        {
          kind: "detection",
          id: "detection/a",
          displayName: "Detection A",
          ui: {},
          config: { defaultConfig: {} },
          createDetector,
        },
      ],
      sampling: [
        {
          kind: "sampling",
          id: "sampling/a",
          displayName: "Sampling A",
          ui: {},
          config: { defaultConfig: {} },
          createSampler,
        },
      ],
      sonification: [
        {
          kind: "sonification",
          id: "sonification/a",
          displayName: "Sonification A",
          ui: {},
          config: { defaultConfig: {} },
          createSonifier: createSonifierA,
        },
        {
          kind: "sonification",
          id: "sonification/b",
          displayName: "Sonification B",
          ui: {},
          config: { defaultConfig: {} },
          createSonifier: createSonifierB,
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
    if (!harnessApi) throw new Error("Harness API not initialized");

    await act(async () => {
      await harnessApi.switchSonificationAndStart("sonification/b");
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createDetector).toHaveBeenCalledTimes(1);
    expect(createSampler).toHaveBeenCalledTimes(1);
    expect(createSonifierA).toHaveBeenCalledTimes(1);
    expect(createSonifierB).toHaveBeenCalledTimes(1);
  });
});

describe("useSonificationEngine runtime errors", () => {
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

  it("stops transport without disposing handles when frame processing enters error state", async () => {
    const stream = createPointStreamController();
    const detectorDispose = vi.fn();
    const samplerDispose = vi.fn();
    const sonifierDispose = vi.fn();

    const config = {
      detection: [
        {
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
              points: vi.fn((signal?: AbortSignal) => stream.points(signal)),
            },
            getSourceSize: vi.fn(() => ({ width: 100, height: 100 })),
          })),
        },
      ],
      sampling: [
        {
          kind: "sampling",
          id: "sampling/a",
          displayName: "Sampling A",
          ui: {},
          config: { defaultConfig: {} },
          createSampler: vi.fn(() => ({
            [Symbol.dispose]: samplerDispose,
            sampler: {
              loadImage: vi.fn().mockResolvedValue(undefined),
              sampleAt: vi.fn(() => new Error("frame failed")),
            },
            getVisibleRect: vi.fn(() => null),
          })),
        },
      ],
      sonification: [
        {
          kind: "sonification",
          id: "sonification/a",
          displayName: "Sonification A",
          ui: {},
          config: { defaultConfig: {} },
          createSonifier: vi.fn(() => ({
            [Symbol.dispose]: sonifierDispose,
            sonifier: {
              initialize: vi.fn().mockResolvedValue(undefined),
              processSamples: vi.fn().mockResolvedValue(undefined),
              stop: vi.fn(),
              configure: vi.fn(),
            },
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

    await startTransportWhenReady(harnessApi.startTransport);

    await act(async () => {
      stream.emit([{ id: "p1", x: 0.5, y: 0.5 }]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(detectorDispose).not.toHaveBeenCalled();
    expect(samplerDispose).not.toHaveBeenCalled();
    expect(sonifierDispose).not.toHaveBeenCalled();
  });

  it("does not recreate handles when toggling transport for the same plugin set", async () => {
    const stream = createPointStreamController();
    const detectorDisposeA = vi.fn();
    const samplerDisposeA = vi.fn();
    const sonifierDisposeA = vi.fn();
    const detectorDisposeB = vi.fn();
    const samplerDisposeB = vi.fn();
    const sonifierDisposeB = vi.fn();
    let startCount = 0;

    const config = {
      detection: [
        {
          kind: "detection",
          id: "detection/a",
          displayName: "Detection A",
          ui: {},
          config: { defaultConfig: {} },
          createDetector: vi.fn(() => {
            startCount += 1;
            const dispose = startCount === 1 ? detectorDisposeA : detectorDisposeB;
            return {
              [Symbol.dispose]: dispose,
              detector: {
                initialize: vi.fn().mockResolvedValue(undefined),
                start: vi.fn().mockResolvedValue(undefined),
                stop: vi.fn(),
                points: vi.fn((signal?: AbortSignal) => stream.points(signal)),
              },
              getSourceSize: vi.fn(() => ({ width: 100, height: 100 })),
            };
          }),
        },
      ],
      sampling: [
        {
          kind: "sampling",
          id: "sampling/a",
          displayName: "Sampling A",
          ui: {},
          config: { defaultConfig: {} },
          createSampler: vi.fn(() => {
            const dispose = startCount === 1 ? samplerDisposeA : samplerDisposeB;
            return {
              [Symbol.dispose]: dispose,
              sampler: {
                loadImage: vi.fn().mockResolvedValue(undefined),
                sampleAt: vi.fn(() => new Map()),
              },
              getVisibleRect: vi.fn(() => null),
            };
          }),
        },
      ],
      sonification: [
        {
          kind: "sonification",
          id: "sonification/a",
          displayName: "Sonification A",
          ui: {},
          config: { defaultConfig: {} },
          createSonifier: vi.fn(() => {
            const dispose = startCount === 1 ? sonifierDisposeA : sonifierDisposeB;
            return {
              [Symbol.dispose]: dispose,
              sonifier: {
                initialize: vi.fn().mockResolvedValue(undefined),
                processSamples: vi.fn().mockResolvedValue(undefined),
                stop: vi.fn(),
                configure: vi.fn(),
              },
            };
          }),
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

    await startTransportWhenReady(harnessApi.startTransport);
    expect(startCount).toBe(1);

    expect(detectorDisposeA).not.toHaveBeenCalled();
    expect(samplerDisposeA).not.toHaveBeenCalled();
    expect(sonifierDisposeA).not.toHaveBeenCalled();

    await startTransportWhenReady(harnessApi.startTransport);

    expect(detectorDisposeA).not.toHaveBeenCalled();
    expect(samplerDisposeA).not.toHaveBeenCalled();
    expect(sonifierDisposeA).not.toHaveBeenCalled();

    act(() => {
      harnessApi.stopTransport();
    });

    expect(detectorDisposeA).not.toHaveBeenCalled();
    expect(samplerDisposeA).not.toHaveBeenCalled();
    expect(sonifierDisposeA).not.toHaveBeenCalled();
    expect(detectorDisposeB).not.toHaveBeenCalled();
    expect(samplerDisposeB).not.toHaveBeenCalled();
    expect(sonifierDisposeB).not.toHaveBeenCalled();
  });
});
