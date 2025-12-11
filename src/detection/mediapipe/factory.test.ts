import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMediaPipeDetector } from "#src/detection/mediapipe/factory";
import { MediaPipePointDetector } from "#src/detection/mediapipe/MediaPipePointDetector";
import type { DetectorControls } from "#src/detection/mediapipe/uiControls";

vi.mock("#src/detection/mediapipe/MediaPipePointDetector");
vi.mock("#src/detection/mediapipe/uiControls");

describe("getMediaPipeDetector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("creates detector once and reuses singleton", () => {
    const mockControls = {
      state: { maxHands: 2, isMirrored: false, facingMode: "user" },
      elements: { videoElement: {} as HTMLVideoElement },
      attach: vi.fn(),
    } as unknown as DetectorControls;

    const first = getMediaPipeDetector(mockControls);
    const second = getMediaPipeDetector(mockControls);

    expect(first).toBe(second);
    expect(MediaPipePointDetector).toHaveBeenCalledTimes(1);
    expect(mockControls.attach).toHaveBeenCalledTimes(1);
  });
});
