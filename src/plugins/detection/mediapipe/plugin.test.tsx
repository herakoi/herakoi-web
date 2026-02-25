/**
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultMediaPipeConfig } from "./config";
import { useDeviceStore } from "./deviceStore";
import { MediaPipePointDetector } from "./MediaPipePointDetector";
import { plugin } from "./plugin";
import { mediaPipeRefs } from "./refs";

const expectDetectorHandle = (result: ReturnType<typeof plugin.createDetector>) => {
  if (result instanceof Error) throw result;
  return result;
};

const { setMirror, setMaxHands, restartCamera, stop } = vi.hoisted(() => ({
  setMirror: vi.fn(),
  setMaxHands: vi.fn(),
  restartCamera: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
}));

vi.mock("./MediaPipePointDetector", () => {
  const MockClass = vi.fn().mockImplementation(
    class {
      public setMirror = setMirror;
      public setMaxHands = setMaxHands;
      public restartCamera = restartCamera;
      public stop = stop;
      public initialize = vi.fn().mockResolvedValue(undefined);
      public start = vi.fn().mockResolvedValue(undefined);
      public onPointsDetected = vi.fn();
      public onHandsDrawn = vi.fn();
      public getActiveFacingMode = vi.fn().mockReturnValue(undefined);
      // biome-ignore lint/suspicious/noExplicitAny: Constructor mocking requires widened signature in tests
    } as unknown as (...args: any[]) => any,
  );
  (MockClass as unknown as Record<string, unknown>).enumerateDevices = vi
    .fn()
    .mockResolvedValue([]);
  return { MediaPipePointDetector: MockClass };
});

describe("MediaPipe detection plugin runtime subscription lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDeviceStore.setState({
      devices: [],
      deviceId: undefined,
      mirror: true,
      restartCamera: null,
    });
    mediaPipeRefs.video = { current: document.createElement("video") };
    mediaPipeRefs.videoOverlay = null;
    mediaPipeRefs.imageOverlay = null;
    useDeviceStore.getState().setHasHands(null);
  });

  it("unsubscribes config listener during cleanup", () => {
    const unsubscribe = vi.fn();
    const runtime = {
      getConfig: vi.fn(() => defaultMediaPipeConfig),
      setConfig: vi.fn(),
      subscribeConfig: vi.fn(() => unsubscribe),
    };

    const handle = expectDetectorHandle(plugin.createDetector(defaultMediaPipeConfig, runtime));
    handle.postInitialize?.();
    handle.cleanup?.();

    expect(runtime.subscribeConfig).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("clears stale selected device after refresh and does not reuse it on next start", async () => {
    const staleDeviceId = "external-webcam";
    const enumerateDevices = (
      MediaPipePointDetector as unknown as { enumerateDevices: ReturnType<typeof vi.fn> }
    ).enumerateDevices;

    enumerateDevices.mockResolvedValueOnce([
      { deviceId: "builtin-camera", label: "Built-in Camera" },
    ]);

    useDeviceStore.getState().setDeviceId(staleDeviceId);

    const runtime = {
      getConfig: vi.fn(() => defaultMediaPipeConfig),
      setConfig: vi.fn(),
      subscribeConfig: vi.fn(() => vi.fn()),
    };

    const firstHandle = expectDetectorHandle(
      plugin.createDetector(defaultMediaPipeConfig, runtime),
    );
    firstHandle.postInitialize?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(useDeviceStore.getState().devices).toEqual([
      { deviceId: "builtin-camera", label: "Built-in Camera" },
    ]);
    expect(useDeviceStore.getState().deviceId).toBeUndefined();

    firstHandle.cleanup?.();
    plugin.createDetector(defaultMediaPipeConfig, runtime);

    expect(MediaPipePointDetector).toHaveBeenNthCalledWith(
      2,
      expect.any(HTMLVideoElement),
      expect.objectContaining({ deviceId: undefined }),
    );
  });

  it("does not pass a stale selected device to detector construction when startup has not reached postInitialize", () => {
    useDeviceStore.setState({
      devices: [],
      deviceId: "stale-unplugged-camera",
      mirror: true,
      restartCamera: null,
    });

    const runtime = {
      getConfig: vi.fn(() => defaultMediaPipeConfig),
      setConfig: vi.fn(),
      subscribeConfig: vi.fn(() => vi.fn()),
    };

    plugin.createDetector(defaultMediaPipeConfig, runtime);

    expect(MediaPipePointDetector).toHaveBeenCalledWith(
      expect.any(HTMLVideoElement),
      expect.objectContaining({ deviceId: undefined }),
    );
  });

  it("resets hasHands to null on cleanup", () => {
    const runtime = {
      getConfig: vi.fn(() => defaultMediaPipeConfig),
      setConfig: vi.fn(),
      subscribeConfig: vi.fn(() => vi.fn()),
    };

    const handle = expectDetectorHandle(plugin.createDetector(defaultMediaPipeConfig, runtime));
    handle.postInitialize?.();
    useDeviceStore.getState().setHasHands(true);
    handle.cleanup?.();

    expect(useDeviceStore.getState().hasHands).toBeNull();
  });
});

describe("MediaPipe detection plugin hand tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mediaPipeRefs.video = { current: document.createElement("video") };
    mediaPipeRefs.videoOverlay = null;
    mediaPipeRefs.imageOverlay = null;
    useDeviceStore.getState().setHasHands(null);
  });

  it("sets hasHands to false on first empty detection frame", () => {
    const runtime = {
      getConfig: vi.fn(() => defaultMediaPipeConfig),
      setConfig: vi.fn(),
      subscribeConfig: vi.fn(() => vi.fn()),
    };

    const handle = expectDetectorHandle(plugin.createDetector(defaultMediaPipeConfig, runtime));
    handle.postInitialize?.();

    // Find the onPointsDetected callback registered by postInitialize
    // (it is the last registered callback; no canvases means no bindHandsUi call)
    const { onPointsDetected } = handle.detector as unknown as {
      onPointsDetected: ReturnType<typeof vi.fn>;
    };
    const callback = onPointsDetected.mock.calls[0]?.[0] as
      | ((points: unknown[]) => void)
      | undefined;
    expect(callback).toBeTypeOf("function");

    callback?.([]);

    expect(useDeviceStore.getState().hasHands).toBe(false);
  });

  it("sets hasHands to true when points are detected", () => {
    const runtime = {
      getConfig: vi.fn(() => defaultMediaPipeConfig),
      setConfig: vi.fn(),
      subscribeConfig: vi.fn(() => vi.fn()),
    };

    const handle = expectDetectorHandle(plugin.createDetector(defaultMediaPipeConfig, runtime));
    handle.postInitialize?.();

    const { onPointsDetected } = handle.detector as unknown as {
      onPointsDetected: ReturnType<typeof vi.fn>;
    };
    const callback = onPointsDetected.mock.calls[0]?.[0] as
      | ((points: unknown[]) => void)
      | undefined;

    callback?.([{ id: "index-0", x: 0.5, y: 0.5 }]);

    expect(useDeviceStore.getState().hasHands).toBe(true);
  });

  it("does not call setHasHands on repeated frames with the same state", () => {
    const runtime = {
      getConfig: vi.fn(() => defaultMediaPipeConfig),
      setConfig: vi.fn(),
      subscribeConfig: vi.fn(() => vi.fn()),
    };

    const handle = expectDetectorHandle(plugin.createDetector(defaultMediaPipeConfig, runtime));
    handle.postInitialize?.();

    const { onPointsDetected } = handle.detector as unknown as {
      onPointsDetected: ReturnType<typeof vi.fn>;
    };
    const callback = onPointsDetected.mock.calls[0]?.[0] as
      | ((points: unknown[]) => void)
      | undefined;

    // Spy after postInitialize to only catch subsequent setHasHands calls
    const setHasHands = vi.spyOn(useDeviceStore.getState(), "setHasHands");

    callback?.([]);
    callback?.([]);

    expect(setHasHands).toHaveBeenCalledTimes(1);
    expect(setHasHands).toHaveBeenCalledWith(false);
  });
});
