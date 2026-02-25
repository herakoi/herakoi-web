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
    it("should call getUserMedia with default constraints and return void on success", async () => {
      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      const result = await camera.start();
      camera.stop();

      expect(result).toBeUndefined();
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
    });

    it("should call getUserMedia with exact deviceId when specified and return void on success", async () => {
      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, {
        onFrame,
        deviceId: "test-device-123",
      });

      const result = await camera.start();
      camera.stop();

      expect(result).toBeUndefined();
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: {
          deviceId: { exact: "test-device-123" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
    });

    it("should assign stream to video and call play on success", async () => {
      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      const result = await camera.start();
      camera.stop();

      expect(result).toBeUndefined();
      expect(videoElement.srcObject).toBeNull(); // null after stop
      expect(videoElement.play).toHaveBeenCalled();
    });

    it("should return Error when mediaDevices is undefined", async () => {
      Object.defineProperty(navigator, "mediaDevices", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      const result = await camera.start();

      expect(result).toBeInstanceOf(Error);
      expect(result?.message).toContain("Camera requires HTTPS or localhost");
    });

    it("should return Error with user-friendly message for NotAllowedError", async () => {
      const notAllowedError = new DOMException("Permission denied", "NotAllowedError");
      (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
        notAllowedError,
      );

      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      const result = await camera.start();

      expect(result).toBeInstanceOf(Error);
      expect(result?.message).toBe(
        "La camera richiede i permessi. Verifica le impostazioni del browser e riprova.",
      );
    });

    it("should return Error with user-friendly message for NotFoundError", async () => {
      const notFoundError = new DOMException("Requested device not found", "NotFoundError");
      (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
        notFoundError,
      );

      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      const result = await camera.start();

      expect(result).toBeInstanceOf(Error);
      expect(result?.message).toBe(
        "Nessuna camera trovata. Verifica che una camera sia collegata.",
      );
    });

    it("should return Error with user-friendly message for NotReadableError", async () => {
      const notReadableError = new DOMException("Camera already in use", "NotReadableError");
      (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
        notReadableError,
      );

      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      const result = await camera.start();

      expect(result).toBeInstanceOf(Error);
      expect(result?.message).toBe("La camera è già in uso da un'altra app. Chiudila e riprova.");
    });

    it("should return Error with user-friendly message for SecurityError", async () => {
      const securityError = new DOMException("Not secure", "SecurityError");
      (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
        securityError,
      );

      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      const result = await camera.start();

      expect(result).toBeInstanceOf(Error);
      expect(result?.message).toBe("L'accesso alla camera è bloccato per motivi di sicurezza.");
    });

    it("should return Error with user-friendly message for OverconstrainedError", async () => {
      const overconstrainedError = new DOMException(
        "Constraints not satisfied",
        "OverconstrainedError",
      );
      (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
        overconstrainedError,
      );

      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      const result = await camera.start();

      expect(result).toBeInstanceOf(Error);
      expect(result?.message).toBe(
        "Le impostazioni richieste non sono supportate dalla tua camera.",
      );
    });

    it("should return Error with user-friendly message for TypeError", async () => {
      const typeError = new TypeError("Invalid constraints");
      (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
        typeError,
      );

      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      const result = await camera.start();

      expect(result).toBeInstanceOf(Error);
      expect(result?.message).toBe("Camera non disponibile.");
    });

    it("should return Error with original message for unknown errors", async () => {
      const unknownError = new Error("Some unknown error");
      (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
        unknownError,
      );

      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      const result = await camera.start();

      expect(result).toBeInstanceOf(Error);
      expect(result?.message).toBe("Some unknown error");
    });

    it("should treat interrupted play as benign when stream was superseded", async () => {
      const onFrame = vi.fn();
      const camera = new NativeCamera(videoElement, { onFrame });

      const newerTrack = {
        stop: vi.fn(),
        getSettings: vi.fn().mockReturnValue({ facingMode: "environment" }),
      } as unknown as MediaStreamTrack;
      const newerStream = {
        getTracks: vi.fn().mockReturnValue([newerTrack]),
        getVideoTracks: vi.fn().mockReturnValue([newerTrack]),
      } as unknown as MediaStream;

      vi.spyOn(videoElement, "play").mockImplementation(async () => {
        videoElement.srcObject = newerStream;
        throw new Error(
          "The play() request was interrupted by a new load request. https://goo.gl/LdLk22",
        );
      });

      const result = await camera.start();

      expect(result).toBeUndefined();
      expect(videoElement.srcObject).toBe(newerStream);
      expect(newerTrack.stop).not.toHaveBeenCalled();
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

    it("should not clear a newer stream attached to the same video element", async () => {
      const onFrame = vi.fn();
      const firstCamera = new NativeCamera(videoElement, { onFrame });

      await firstCamera.start();

      const newerTrack = {
        stop: vi.fn(),
        getSettings: vi.fn().mockReturnValue({ facingMode: "environment" }),
      } as unknown as MediaStreamTrack;
      const newerStream = {
        getTracks: vi.fn().mockReturnValue([newerTrack]),
        getVideoTracks: vi.fn().mockReturnValue([newerTrack]),
      } as unknown as MediaStream;

      videoElement.srcObject = newerStream;
      firstCamera.stop();

      expect(videoElement.srcObject).toBe(newerStream);
      expect(newerTrack.stop).not.toHaveBeenCalled();
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
