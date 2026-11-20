/**
 * Native camera wrapper that replaces @mediapipe/camera_utils Camera.
 *
 * Uses getUserMedia directly, providing:
 * - Clear error messages (e.g. "Camera requires HTTPS or localhost")
 * - Device selection via deviceId constraint
 * - Access to active facingMode via track settings
 * - Frame loop via requestVideoFrameCallback (fallback: requestAnimationFrame)
 * - Reopens the camera when its feed ends or stalls, so a long-running page keeps tracking
 */

/** Waiting this long for a video frame means the camera feed has stalled. */
export const CAMERA_STALL_MS = 3000;

/**
 * Convert DOMException errors from getUserMedia into user-friendly messages.
 * Implements Go-style error handling: returns error as value rather than throwing.
 */
function getUserMediaErrorMessage(error: unknown): string {
  // Check for DOMException with name property
  if (typeof error === "object" && error !== null && "name" in error) {
    const errorName = (error as { name: string }).name;

    switch (errorName) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Camera permission is required. Check your browser settings and try again.";
      case "NotFoundError":
        return "No camera found. Check that a camera is connected.";
      case "NotReadableError":
        return "The camera is already in use by another app. Close it and try again.";
      case "SecurityError":
        return "Camera access is blocked for security reasons.";
      case "OverconstrainedError":
        return "Your camera does not support the requested settings.";
      case "TypeError":
        return "Camera unavailable.";
    }
  }

  // Fallback: use the original error message if available
  if (error instanceof Error) {
    return error.message;
  }

  // Last resort fallback
  return "Could not access the camera. Try again.";
}

function isPlayInterruptedByNewLoad(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("play() request was interrupted") && message.includes("new load request");
}

export interface DeviceInfo {
  deviceId: string;
  label: string;
  facingMode?: string;
}

export interface NativeCameraOptions {
  /** Specific device to use. Empty string = browser default. */
  deviceId?: string;
  /** Desired width (optional, used as ideal constraint) */
  width?: number;
  /** Desired height (optional, used as ideal constraint) */
  height?: number;
  /** Called on every video frame */
  onFrame: () => Promise<void> | void;
}

export class NativeCamera {
  private readonly videoElement: HTMLVideoElement;
  private readonly options: NativeCameraOptions;
  private stream: MediaStream | null = null;
  private frameCallbackId: number | null = null;
  private running = false;
  /** Set by stop() so that a pending start() can clean up on resolve. */
  private stopped = false;
  /** Bumped when the stream is released, so the frame loop of an older stream exits. */
  private generation = 0;
  /** When the loop began waiting for a video frame; null while a frame is processed. */
  private waitingSince: number | null = null;
  private watchdogId: ReturnType<typeof setInterval> | null = null;
  private recovering = false;
  private readonly handleTrackEnded = () => void this.recover("ended");

  constructor(videoElement: HTMLVideoElement, options: NativeCameraOptions) {
    this.videoElement = videoElement;
    this.options = options;
  }

  /**
   * Start camera stream using Go-style error handling.
   * Returns Error on failure, undefined on success.
   */
  async start(): Promise<Error | undefined> {
    if (!navigator.mediaDevices?.getUserMedia) {
      return new Error(
        "Camera requires HTTPS or localhost. Use pnpm dev:https for HTTPS development.",
      );
    }

    this.stopped = false;

    const error = await this.openStream();
    if (error) return error;
    // No stream means stop() or a newer load cancelled this start.
    if (!this.stream) return;

    this.running = true;
    this.watchdogId ??= setInterval(() => this.checkForStall(), CAMERA_STALL_MS / 3);
    this.scheduleFrame();
  }

  /**
   * Open the camera and attach it to the video element.
   * Leaves `stream` null when the open was cancelled.
   */
  private async openStream(): Promise<Error | undefined> {
    const videoConstraints: MediaTrackConstraints = {};
    if (this.options.deviceId) {
      videoConstraints.deviceId = { exact: this.options.deviceId };
    }
    if (this.options.width != null) {
      videoConstraints.width = { ideal: this.options.width };
    }
    if (this.options.height != null) {
      videoConstraints.height = { ideal: this.options.height };
    }

    const constraints: MediaStreamConstraints = {
      video: Object.keys(videoConstraints).length > 0 ? videoConstraints : true,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // If stop() was called while getUserMedia was pending, release immediately.
      if (this.stopped) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        return;
      }

      this.stream = stream;
      this.videoElement.srcObject = this.stream;
      try {
        await this.videoElement.play();
      } catch (err) {
        // stop() can be called while play() is pending (e.g. camera switch).
        // The browser aborts play() with an AbortError — expected, not a real error.
        if (this.stopped) return;
        // Another flow may have replaced srcObject while this play() was in-flight.
        // In that case treat this as a benign cancellation, not a runtime failure.
        if (isPlayInterruptedByNewLoad(err) && this.videoElement.srcObject !== stream) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          if (this.stream === stream) {
            this.stream = null;
          }
          return;
        }
        throw err;
      }

      for (const track of stream.getVideoTracks()) {
        track.addEventListener("ended", this.handleTrackEnded);
      }
    } catch (err) {
      // Convert DOMException or any error into a user-friendly message
      const message = getUserMediaErrorMessage(err);
      return new Error(message);
    }
  }

  stop(): void {
    this.stopped = true;
    this.running = false;

    if (this.watchdogId != null) {
      clearInterval(this.watchdogId);
      this.watchdogId = null;
    }

    this.releaseStream();
  }

  /** Cancel the frame loop, stop the stream, and detach it from the video element. */
  private releaseStream(): void {
    this.generation++;
    this.waitingSince = null;

    if (this.frameCallbackId != null) {
      // Cancel whichever loop is active
      if ("cancelVideoFrameCallback" in this.videoElement) {
        (
          this.videoElement as HTMLVideoElement & { cancelVideoFrameCallback(id: number): void }
        ).cancelVideoFrameCallback(this.frameCallbackId);
      } else {
        cancelAnimationFrame(this.frameCallbackId);
      }
      this.frameCallbackId = null;
    }

    const ownStream = this.stream;

    // Stop tracks from our stored reference.
    if (ownStream) {
      for (const track of ownStream.getTracks()) {
        track.removeEventListener("ended", this.handleTrackEnded);
        track.stop();
      }
      this.stream = null;
    }

    // Do not clobber a newer camera instance attached to the same video element.
    if (this.videoElement.srcObject === ownStream) {
      this.videoElement.srcObject = null;
      this.videoElement.pause();
    }
  }

  /** Returns the facingMode reported by the active video track, if available. */
  get activeFacingMode(): string | undefined {
    if (!this.stream) return undefined;
    const track = this.stream.getVideoTracks()[0];
    if (!track) return undefined;
    return track.getSettings().facingMode;
  }

  /** Enumerate available video input devices. */
  static async enumerateVideoDevices(): Promise<DeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return [];
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === "videoinput" && d.deviceId !== "")
      .map((d) => {
        let facingMode: string | undefined;
        if ("getCapabilities" in d && typeof d.getCapabilities === "function") {
          const caps = d.getCapabilities() as { facingMode?: string[] };
          facingMode = caps.facingMode?.[0];
        }
        return {
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
          facingMode,
        };
      });
  }

  /**
   * Reopen the camera after its feed ended or stalled (unplugged webcam, macOS camera
   * interruption, another app taking the device). A failed reopen is retried by the watchdog.
   */
  private async recover(reason: "ended" | "stalled"): Promise<void> {
    if (!this.running || this.recovering) return;
    this.recovering = true;
    console.warn(`Camera feed ${reason}; reopening the camera.`);

    this.releaseStream();
    const error = await this.openStream();
    this.recovering = false;

    if (!this.running) return;
    if (error || !this.stream) {
      if (error) console.warn("Could not reopen the camera; retrying.", error);
      this.waitingSince = Date.now();
      return;
    }
    this.scheduleFrame();
  }

  private checkForStall(): void {
    if (this.waitingSince == null) return;
    // A hidden page receives no video frames; that is not a stall.
    if (document.hidden) {
      this.waitingSince = Date.now();
      return;
    }
    if (Date.now() - this.waitingSince > CAMERA_STALL_MS) {
      void this.recover("stalled");
    }
  }

  private scheduleFrame(): void {
    if (!this.running) return;

    const generation = this.generation;
    const loop = async () => {
      if (!this.running || generation !== this.generation) return;
      this.waitingSince = null;
      try {
        await this.options.onFrame();
      } catch (error) {
        // One failed frame must not end the loop: the next frame tries again.
        console.error("Camera frame processing failed:", error);
      }
      if (generation !== this.generation) return;
      this.scheduleFrame();
    };

    this.waitingSince = Date.now();

    if ("requestVideoFrameCallback" in this.videoElement) {
      this.frameCallbackId = (
        this.videoElement as HTMLVideoElement & {
          requestVideoFrameCallback(cb: () => void): number;
        }
      ).requestVideoFrameCallback(() => void loop());
    } else {
      this.frameCallbackId = requestAnimationFrame(() => void loop());
    }
  }
}
