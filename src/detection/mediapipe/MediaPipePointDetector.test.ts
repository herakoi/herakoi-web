/**
 * Tests for MediaPipePointDetector
 *
 * This test suite verifies MediaPipePointDetector implements the PointDetector interface
 * correctly by wrapping MediaPipe Hands and Camera utilities.
 *
 * Test strategy:
 * - Use real HandsDetector class (tests actual integration)
 * - Mock external dependencies (@mediapipe/hands, @mediapipe/camera_utils)
 * - Verify lifecycle and point detection conversion
 *
 * @vitest-environment happy-dom
 *
 * This directive tells Vitest to run these tests in a happy-dom environment instead
 * of the default Node.js environment. happy-dom is a lightweight JavaScript implementation
 * of browser APIs (window, document, HTMLElement, etc.).
 *
 * Why we need it here:
 * - Tests work with HTMLVideoElement (camera input for MediaPipe)
 * - MediaPipe expects browser globals and DOM APIs
 * - Mocking requires browser-like environment for proper type checking
 *
 * Alternative environments:
 * - node (default): No DOM, fastest, use for pure logic tests
 * - jsdom: Full DOM implementation, heavier/slower, use only if happy-dom insufficient
 *
 * Convention: Add this directive only to test files that need browser APIs.
 * Omit it for pure TypeScript logic tests to keep them fast.
 */

import type { Results } from "@mediapipe/hands";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Store MediaPipe Hands onResults callback for test simulation
let mockOnResultsCallback: ((results: Results) => void) | null = null;

// Store Camera instances for test assertions
let lastCameraInstance: {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
} | null = null;

// Mock MediaPipe Hands class
const HandsMock = vi.fn();
vi.mock("@mediapipe/hands", () => ({
  Hands: HandsMock,
}));

// Mock Camera class
const CameraMock = vi.fn();
vi.mock("@mediapipe/camera_utils", () => ({
  Camera: CameraMock,
}));

describe("MediaPipePointDetector", () => {
  let videoElement: HTMLVideoElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnResultsCallback = null;
    lastCameraInstance = null;
    videoElement = document.createElement("video") as HTMLVideoElement;

    // Setup Hands mock - must be a class constructor
    // Using `as unknown as (...args: any[]) => any` because vitest mockImplementation
    // expects a function signature, not a constructor type
    HandsMock.mockImplementation(
      class {
        public setOptions = vi.fn();
        public onResults = vi.fn((callback: (results: Results) => void) => {
          mockOnResultsCallback = callback;
        });
        public send = vi.fn().mockResolvedValue(undefined);
        public initialize = vi.fn().mockResolvedValue(undefined);
        public close = vi.fn();
        // biome-ignore lint/suspicious/noExplicitAny: Vitest mock requires constructor signature loosening in this test double
      } as unknown as (...args: any[]) => any,
    );

    // Setup Camera mock - must be a class constructor
    CameraMock.mockImplementation(
      class {
        public start = vi.fn().mockResolvedValue(undefined);
        public stop = vi.fn();

        constructor(_videoElement: HTMLVideoElement, _config: unknown) {
          lastCameraInstance = this;
        }
        // biome-ignore lint/suspicious/noExplicitAny: Vitest mock requires constructor signature loosening in this test double
      } as unknown as (...args: any[]) => any,
    );
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
    it("should create HandsDetector and Camera", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement, { maxHands: 2 });

      await detector.initialize();

      // HandsDetector should be created (which creates Hands instance)
      expect(HandsMock).toHaveBeenCalled();

      // Camera should be created
      expect(CameraMock).toHaveBeenCalledWith(
        videoElement,
        expect.objectContaining({ onFrame: expect.any(Function) }),
      );
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

      // Should only create resources once
      expect(HandsMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("start()", () => {
    it("should throw if not initialized", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);

      expect(() => detector.start()).toThrow("must be initialized");
    });

    it("should start camera after initialization", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);

      await detector.initialize();
      detector.start();

      expect(lastCameraInstance).not.toBeNull();
      expect(lastCameraInstance?.start).toHaveBeenCalled();
    });
  });

  describe("stop()", () => {
    it("should stop camera", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);

      await detector.initialize();
      detector.start();
      detector.stop();

      expect(lastCameraInstance).not.toBeNull();
      expect(lastCameraInstance?.stop).toHaveBeenCalled();
    });

    it("should be safe to call multiple times", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);

      await detector.initialize();
      detector.start();
      detector.stop();
      detector.stop();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("onPointsDetected()", () => {
    it("should register callback", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);
      const callback = vi.fn();

      detector.onPointsDetected(callback);

      expect(callback).not.toHaveBeenCalled(); // Not called yet
    });

    it("should invoke callback when hands detected", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);
      const callback = vi.fn();

      await detector.initialize();
      detector.onPointsDetected(callback);

      // Simulate MediaPipe detecting one hand with index finger
      const mockImage = document.createElement("img") as HTMLImageElement;
      const mockResults: Results = {
        image: mockImage,
        multiHandLandmarks: [
          // Hand 0 with index finger tip at (0.5, 0.6)
          Array.from({ length: 21 }, (_, i) =>
            i === 8 ? { x: 0.5, y: 0.6, z: 0 } : { x: 0, y: 0, z: 0 },
          ),
        ],
        multiHandedness: [],
        multiHandWorldLandmarks: [],
      };

      mockOnResultsCallback?.(mockResults);

      expect(callback).toHaveBeenCalledWith([
        {
          id: "hand-0-index-tip",
          x: 0.5,
          y: 0.6,
        },
      ]);
    });

    it("should emit multiple points for multiple hands", async () => {
      const { MediaPipePointDetector } = await import("./MediaPipePointDetector");
      const detector = new MediaPipePointDetector(videoElement);
      const callback = vi.fn();

      await detector.initialize();
      detector.onPointsDetected(callback);

      // Simulate MediaPipe detecting two hands
      const mockImage = document.createElement("img") as HTMLImageElement;
      const mockResults: Results = {
        image: mockImage,
        multiHandLandmarks: [
          // Hand 0 index finger at (0.3, 0.4)
          Array.from({ length: 21 }, (_, i) =>
            i === 8 ? { x: 0.3, y: 0.4, z: 0 } : { x: 0, y: 0, z: 0 },
          ),
          // Hand 1 index finger at (0.7, 0.8)
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

      // Simulate MediaPipe detecting no hands
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

      // Simulate detection
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
  });
});
