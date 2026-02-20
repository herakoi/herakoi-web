/**
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultMediaPipeConfig } from "./config";
import { plugin } from "./plugin";
import { mediaPipeRefs } from "./refs";

const setMirror = vi.fn();
const setMaxHands = vi.fn();
const restartCamera = vi.fn().mockResolvedValue(undefined);
const stop = vi.fn();

vi.mock("./MediaPipePointDetector", () => ({
  MediaPipePointDetector: vi.fn().mockImplementation(
    class {
      public setMirror = setMirror;
      public setMaxHands = setMaxHands;
      public restartCamera = restartCamera;
      public stop = stop;
      public initialize = vi.fn().mockResolvedValue(undefined);
      public start = vi.fn();
      public onPointsDetected = vi.fn();
      public onHandsDrawn = vi.fn();
      // biome-ignore lint/suspicious/noExplicitAny: Constructor mocking requires widened signature in tests
    } as unknown as (...args: any[]) => any,
  ),
}));

describe("MediaPipe detection plugin runtime subscription lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
