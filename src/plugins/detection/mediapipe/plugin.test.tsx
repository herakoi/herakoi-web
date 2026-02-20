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
