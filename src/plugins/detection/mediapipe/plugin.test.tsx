/**
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultMediaPipeConfig } from "./config";
import { useDeviceStore } from "./deviceStore";
import { MediaPipePointDetector } from "./MediaPipePointDetector";
import { plugin } from "./plugin";
import { mediaPipeRefs } from "./refs";

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
  });

  it("unsubscribes config listener during cleanup", () => {
    const unsubscribe = vi.fn();
    const runtime = {
      getConfig: vi.fn(() => defaultMediaPipeConfig),
      setConfig: vi.fn(),
      subscribeConfig: vi.fn(() => unsubscribe),
    };

    const handle = plugin.createDetector(defaultMediaPipeConfig, runtime);
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

    const firstHandle = plugin.createDetector(defaultMediaPipeConfig, runtime);
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
});

describe("MediaPipe detection plugin notification flow", () => {
  it("shows the no-hand prompt on the first empty detection frame", () => {
    const onPointsDetected = vi.fn();
    const detector = { onPointsDetected };
    const showNotification = vi.fn();
    const hideNotification = vi.fn();

    plugin.bindPipelineEvents(detector as never, { showNotification, hideNotification });

    const pointsHandler = onPointsDetected.mock.calls[0]?.[0] as
      | ((points: unknown[]) => void)
      | undefined;
    expect(pointsHandler).toBeTypeOf("function");

    pointsHandler?.([]);

    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith(
      "mediapipe-hand-prompt",
      expect.objectContaining({
        message: "Move your index finger in front of the camera to play",
      }),
    );
    expect(hideNotification).not.toHaveBeenCalled();
  });

  it("does not re-show the prompt on repeated empty detection frames", () => {
    const onPointsDetected = vi.fn();
    const detector = { onPointsDetected };
    const showNotification = vi.fn();
    const hideNotification = vi.fn();

    plugin.bindPipelineEvents(detector as never, { showNotification, hideNotification });

    const pointsHandler = onPointsDetected.mock.calls[0]?.[0] as
      | ((points: unknown[]) => void)
      | undefined;
    expect(pointsHandler).toBeTypeOf("function");

    pointsHandler?.([]);
    pointsHandler?.([]);

    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(hideNotification).not.toHaveBeenCalled();
  });
});
