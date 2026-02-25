/**
 * Tests for NativeCamera
 *
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NativeCamera } from "./NativeCamera";

describe("NativeCamera", () => {
  let videoElement: HTMLVideoElement;
  let mockStream: MediaStream;
  let mockTrack: MediaStreamTrack;

  beforeEach(() => {
    videoElement = document.createElement("video") as HTMLVideoElement;
    vi.spyOn(videoElement, "play").mockResolvedValue(undefined);
    // happy-dom validates srcObject type; bypass with a property descriptor
    let storedSrcObject: MediaStream | null = null;
    Object.defineProperty(videoElement, "srcObject", {
      get: () => storedSrcObject,
      set: (v: MediaStream | null) => {
        storedSrcObject = v;
      },
      configurable: true,
    });

    mockTrack = {
      stop: vi.fn(),
      getSettings: vi.fn().mockReturnValue({ facingMode: "user" }),
    } as unknown as MediaStreamTrack;

    mockStream = {
      getTracks: vi.fn().mockReturnValue([mockTrack]),
      getVideoTracks: vi.fn().mockReturnValue([mockTrack]),
    } as unknown as MediaStream;

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("start()", () => {
    it("should call getUserMedia with default constraints", async () => {
      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      await camera.start();
      camera.stop();

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
    });

    it("should call getUserMedia with exact deviceId when specified", async () => {
      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, {
        onFrame,
        deviceId: "test-device-123",
      });

      await camera.start();
      camera.stop();

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: {
          deviceId: { exact: "test-device-123" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
    });

    it("should assign stream to video and call play", async () => {
      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      await camera.start();
      camera.stop();

      expect(videoElement.srcObject).toBeNull(); // null after stop
      expect(videoElement.play).toHaveBeenCalled();
    });

    it("should throw when mediaDevices is undefined", async () => {
      Object.defineProperty(navigator, "mediaDevices", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      await expect(camera.start()).rejects.toThrow("Camera requires HTTPS or localhost");
    });
  });

  describe("stop()", () => {
    it("should stop all tracks and clear srcObject", async () => {
      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      await camera.start();
      camera.stop();

      expect(mockTrack.stop).toHaveBeenCalled();
      expect(videoElement.srcObject).toBeNull();
    });

    it("should be safe to call without start", () => {
      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      expect(() => camera.stop()).not.toThrow();
    });
  });

  describe("activeFacingMode", () => {
    it("should return facingMode from track settings after start", async () => {
      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      await camera.start();

      expect(camera.activeFacingMode).toBe("user");
      camera.stop();
    });

    it("should return undefined before start", () => {
      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      expect(camera.activeFacingMode).toBeUndefined();
    });
  });

  describe("enumerateVideoDevices()", () => {
    it("should filter for videoinput devices", async () => {
      (navigator.mediaDevices.enumerateDevices as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          kind: "videoinput",
          deviceId: "cam1",
          label: "Front Camera",
          getCapabilities: () => ({ facingMode: ["user"] }),
        },
        { kind: "audioinput", deviceId: "mic1", label: "Microphone" },
        {
          kind: "videoinput",
          deviceId: "cam2",
          label: "Rear Camera",
          getCapabilities: () => ({ facingMode: ["environment"] }),
        },
      ]);

      const devices = await NativeCamera.enumerateVideoDevices();

      expect(devices).toHaveLength(2);
      expect(devices[0]).toEqual({
        deviceId: "cam1",
        label: "Front Camera",
        facingMode: "user",
      });
      expect(devices[1]).toEqual({
        deviceId: "cam2",
        label: "Rear Camera",
        facingMode: "environment",
      });
    });

    it("should return empty array when mediaDevices is unavailable", async () => {
      Object.defineProperty(navigator, "mediaDevices", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const devices = await NativeCamera.enumerateVideoDevices();

      expect(devices).toEqual([]);
    });

    it("should provide fallback label when label is empty", async () => {
      (navigator.mediaDevices.enumerateDevices as ReturnType<typeof vi.fn>).mockResolvedValue([
        { kind: "videoinput", deviceId: "abcdef12", label: "" },
      ]);

      const devices = await NativeCamera.enumerateVideoDevices();

      expect(devices[0].label).toBe("Camera abcdef12");
    });
  });
});
