/**
 * Tests for MediaPipePointDetector
 *
 * @vitest-environment happy-dom
 */

import type { Results } from "@mediapipe/hands";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Store MediaPipe Hands onResults callback for test simulation
let mockOnResultsCallback: ((results: Results) => void) | null = null;

// Store NativeCamera instances for test assertions
let lastCameraInstance: {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  activeFacingMode: string | undefined;
} | null = null;

// Mock MediaPipe Hands class
const HandsMock = vi.fn();
vi.mock("@mediapipe/hands", () => ({
  Hands: HandsMock,
}));

// Mock NativeCamera class
const NativeCameraMock = vi.fn();
vi.mock("./NativeCamera", () => ({
  NativeCamera: NativeCameraMock,
}));

describe("MediaPipePointDetector", () => {
  let videoElement: HTMLVideoElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnResultsCallback = null;
    lastCameraInstance = null;
    videoElement = document.createElement("video") as HTMLVideoElement;

    // Setup Hands mock
    HandsMock.mockImplementation(
      class {
        public setOptions = vi.fn();
        public onResults = vi.fn((callback: (results: Results) => void) => {
          mockOnResultsCallback = callback;
        });
        public send = vi.fn().mockResolvedValue(undefined);
        public initialize = vi.fn().mockResolvedValue(undefined);
        public close = vi.fn();
        // biome-ignore lint/suspicious/noExplicitAny: Vitest mock requires constructor signature loosening
      } as unknown as (...args: any[]) => any,
    );

    // Setup NativeCamera mock
    NativeCameraMock.mockImplementation(
      class {
        public start = vi.fn().mockResolvedValue(undefined);
        public stop = vi.fn();
        public activeFacingMode: string | undefined = undefined;

        constructor(_videoElement: HTMLVideoElement, _config: unknown) {
          lastCameraInstance = this;
        }
        // biome-ignore lint/suspicious/noExplicitAny: Vitest mock requires constructor signature loosening
      } as unknown as (...args: any[]) => any,
    );
    (NativeCameraMock as unknown as Record<string, unknown>).enumerateVideoDevices = vi
      .fn()
      .mockResolvedValue([]);
  });

  describe("Constructor", () => {
    it("should accept video element and config", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement, { maxHands: 2 });
      expect(detector).toBeDefined();
    });

    it("should accept video element without config", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);
      expect(detector).toBeDefined();
    });
  });

  describe("initialize()", () => {
    it("should create MediaPipe Hands but not camera", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement, { maxHands: 2 });

      await detector.initialize();

      expect(HandsMock).toHaveBeenCalled();
      // Camera is NOT created in initialize — it's created in start()
      expect(NativeCameraMock).not.toHaveBeenCalled();
    });

    it("should register onResults callback", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);

      await detector.initialize();

      expect(mockOnResultsCallback).not.toBeNull();
    });

    it("should be idempotent (multiple calls safe)", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);

      await detector.initialize();
      await detector.initialize();

      expect(HandsMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("start()", () => {
    it("should return an error if not initialized", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);

      const result = await detector.start();
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain("must be initialized");
    });

    it("should create camera and start it after initialization", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);

      await detector.initialize();
      await detector.start();

      expect(NativeCameraMock).toHaveBeenCalled();
      expect(lastCameraInstance).not.toBeNull();
      expect(lastCameraInstance?.start).toHaveBeenCalled();
    });
  });

  describe("stop()", () => {
    it("should stop camera", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);

      await detector.initialize();
      await detector.start();
      detector.stop();

      expect(lastCameraInstance?.stop).toHaveBeenCalled();
    });

    it("should be safe to call multiple times", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);

      await detector.initialize();
      await detector.start();
      detector.stop();
      detector.stop();

      expect(true).toBe(true);
    });
  });

  describe("onPointsDetected()", () => {
    it("should register callback", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);
      const callback = vi.fn();

      detector.onPointsDetected(callback);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should invoke callback when hands detected", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);
      const callback = vi.fn();

      await detector.initialize();
      detector.onPointsDetected(callback);

      const mockImage = document.createElement("img") as HTMLImageElement;
      const mockResults: Results = {
        image: mockImage,
        multiHandLandmarks: [
          Array.from({ length: 21 }, (_, i) =>
            i === 8 ? { x: 0.5, y: 0.6, z: 0 } : { x: 0, y: 0, z: 0 },
          ),
        ],
        multiHandedness: [],
        multiHandWorldLandmarks: [],
      };

      mockOnResultsCallback?.(mockResults);

      expect(callback).toHaveBeenCalledWith([{ id: "hand-0-index-tip", x: 0.5, y: 0.6 }]);
    });

    it("should emit multiple points for multiple hands", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);
      const callback = vi.fn();

      await detector.initialize();
      detector.onPointsDetected(callback);

      const mockImage = document.createElement("img") as HTMLImageElement;
      const mockResults: Results = {
        image: mockImage,
        multiHandLandmarks: [
          Array.from({ length: 21 }, (_, i) =>
            i === 8 ? { x: 0.3, y: 0.4, z: 0 } : { x: 0, y: 0, z: 0 },
          ),
          Array.from({ length: 21 }, (_, i) =>
            i === 8 ? { x: 0.7, y: 0.8, z: 0 } : { x: 0, y: 0, z: 0 },
          ),
        ],
        multiHandedness: [],
        multiHandWorldLandmarks: [],
      };

      mockOnResultsCallback?.(mockResults);

      expect(callback).toHaveBeenCalledWith([
        { id: "hand-0-index-tip", x: 0.3, y: 0.4 },
        { id: "hand-1-index-tip", x: 0.7, y: 0.8 },
      ]);
    });

    it("should emit empty array when no hands detected", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);
      const callback = vi.fn();

      await detector.initialize();
      detector.onPointsDetected(callback);

      const mockImage = document.createElement("img") as HTMLImageElement;
      const mockResults: Results = {
        image: mockImage,
        multiHandLandmarks: [],
        multiHandedness: [],
        multiHandWorldLandmarks: [],
      };

      mockOnResultsCallback?.(mockResults);

      expect(callback).toHaveBeenCalledWith([]);
    });

    it("should support multiple callbacks", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      await detector.initialize();
      detector.onPointsDetected(callback1);
      detector.onPointsDetected(callback2);

      const mockImage = document.createElement("img") as HTMLImageElement;
      const mockResults: Results = {
        image: mockImage,
        multiHandLandmarks: [
          Array.from({ length: 21 }, (_, i) =>
            i === 8 ? { x: 0.5, y: 0.6, z: 0 } : { x: 0, y: 0, z: 0 },
          ),
        ],
        multiHandedness: [],
        multiHandWorldLandmarks: [],
      };

      mockOnResultsCallback?.(mockResults);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it("should mirror x-coordinates when mirrorX is true", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement, { mirrorX: true });
      const callback = vi.fn();

      await detector.initialize();
      detector.onPointsDetected(callback);

      const mockImage = document.createElement("img") as HTMLImageElement;
      const mockResults: Results = {
        image: mockImage,
        multiHandLandmarks: [
          Array.from({ length: 21 }, (_, i) =>
            i === 8 ? { x: 0.3, y: 0.4, z: 0 } : { x: 0, y: 0, z: 0 },
          ),
        ],
        multiHandedness: [],
        multiHandWorldLandmarks: [],
      };

      mockOnResultsCallback?.(mockResults);

      expect(callback).toHaveBeenCalledWith([{ id: "hand-0-index-tip", x: 0.7, y: 0.4 }]);
    });

    it("should not mirror coordinates when mirrorX is false", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement, { mirrorX: false });
      const callback = vi.fn();

      await detector.initialize();
      detector.onPointsDetected(callback);

      const mockImage = document.createElement("img") as HTMLImageElement;
      const mockResults: Results = {
        image: mockImage,
        multiHandLandmarks: [
          Array.from({ length: 21 }, (_, i) =>
            i === 8 ? { x: 0.3, y: 0.4, z: 0 } : { x: 0, y: 0, z: 0 },
          ),
        ],
        multiHandedness: [],
        multiHandWorldLandmarks: [],
      };

      mockOnResultsCallback?.(mockResults);

      expect(callback).toHaveBeenCalledWith([{ id: "hand-0-index-tip", x: 0.3, y: 0.4 }]);
    });
  });

  describe("onHandsDrawn()", () => {
    it("should invoke drawer callbacks with mirrored landmarks when mirrorX is true", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement, { mirrorX: true });
      const drawer = vi.fn();

      await detector.initialize();
      detector.onHandsDrawn(drawer);

      const mockImage = document.createElement("img") as HTMLImageElement;
      const mockResults: Results = {
        image: mockImage,
        multiHandLandmarks: [Array.from({ length: 21 }, () => ({ x: 0.3, y: 0.4, z: 0 }))],
        multiHandedness: [],
        multiHandWorldLandmarks: [],
      };

      mockOnResultsCallback?.(mockResults);

      expect(drawer).toHaveBeenCalledWith([
        expect.arrayContaining([expect.objectContaining({ x: 0.7, y: 0.4, z: 0 })]),
      ]);
    });

    it("should invoke drawer callbacks with original landmarks when mirrorX is false", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement, { mirrorX: false });
      const drawer = vi.fn();

      await detector.initialize();
      detector.onHandsDrawn(drawer);

      const mockImage = document.createElement("img") as HTMLImageElement;
      const mockResults: Results = {
        image: mockImage,
        multiHandLandmarks: [Array.from({ length: 21 }, () => ({ x: 0.3, y: 0.4, z: 0 }))],
        multiHandedness: [],
        multiHandWorldLandmarks: [],
      };

      mockOnResultsCallback?.(mockResults);

      expect(drawer).toHaveBeenCalledWith([
        expect.arrayContaining([expect.objectContaining({ x: 0.3, y: 0.4, z: 0 })]),
      ]);
    });
  });
});
