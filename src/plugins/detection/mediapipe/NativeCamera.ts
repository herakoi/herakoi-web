/**
 * Native camera wrapper that replaces @mediapipe/camera_utils Camera.
 *
 * Uses getUserMedia directly, providing:
 * - Clear error messages (e.g. "Camera requires HTTPS or localhost")
 * - Device selection via deviceId constraint
 * - Access to active facingMode via track settings
 * - Frame loop via requestVideoFrameCallback (fallback: requestAnimationFrame)
 */

export interface DeviceInfo {
  deviceId: string;
  label: string;
  facingMode?: string;
}

export interface NativeCameraOptions {
  /** Specific device to use. Empty string = browser default. */
  deviceId?: string;
  /** Desired width (default: 640) */
  width?: number;
  /** Desired height (default: 480) */
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

  constructor(videoElement: HTMLVideoElement, options: NativeCameraOptions) {
    this.videoElement = videoElement;
    this.options = options;
  }

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Camera requires HTTPS or localhost. Use pnpm dev:https for HTTPS development.",
      );
    }

    this.stopped = false;

    const constraints: MediaStreamConstraints = {
      video: this.options.deviceId
        ? {
            deviceId: { exact: this.options.deviceId },
            width: { ideal: this.options.width ?? 640 },
            height: { ideal: this.options.height ?? 480 },
          }
        : {
            width: { ideal: this.options.width ?? 640 },
            height: { ideal: this.options.height ?? 480 },
          },
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    // If stop() was called while getUserMedia was pending, release immediately
    if (this.stopped) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      return;
    }

    this.stream = stream;
    this.videoElement.srcObject = this.stream;
    await this.videoElement.play();

    this.running = true;
    this.scheduleFrame();
  }

  stop(): void {
    this.stopped = true;
    this.running = false;

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

    // Stop tracks from our stored reference
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }

    // Also stop any tracks on the video element itself (belt-and-suspenders)
    const existingSrc = this.videoElement.srcObject as MediaStream | null;
    if (existingSrc) {
      for (const track of existingSrc.getTracks()) {
        track.stop();
      }
    }

    this.videoElement.srcObject = null;
    this.videoElement.pause();
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
      .filter((d) => d.kind === "videoinput")
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

  private scheduleFrame(): void {
    if (!this.running) return;

    const loop = async () => {
      if (!this.running) return;
      await this.options.onFrame();
      this.scheduleFrame();
    };

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
