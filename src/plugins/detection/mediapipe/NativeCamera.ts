/**
 * Native camera wrapper that replaces @mediapipe/camera_utils Camera.
 *
 * Uses getUserMedia directly, providing:
 * - Clear error messages (e.g. "Camera requires HTTPS or localhost")
 * - Device selection via deviceId constraint
 * - Access to active facingMode via track settings
 * - Frame loop via requestVideoFrameCallback (fallback: requestAnimationFrame)
 */

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
        return "La camera richiede i permessi. Verifica le impostazioni del browser e riprova.";
      case "NotFoundError":
        return "Nessuna camera trovata. Verifica che una camera sia collegata.";
      case "NotReadableError":
        return "La camera è già in uso da un'altra app. Chiudila e riprova.";
      case "SecurityError":
        return "L'accesso alla camera è bloccato per motivi di sicurezza.";
      case "OverconstrainedError":
        return "Le impostazioni richieste non sono supportate dalla tua camera.";
      case "TypeError":
        return "Camera non disponibile.";
    }
  }

  // Fallback: use the original error message if available
  if (error instanceof Error) {
    return error.message;
  }

  // Last resort fallback
  return "Errore durante l'accesso alla camera. Riprova.";
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

      this.running = true;
      this.scheduleFrame();
    } catch (err) {
      // Convert DOMException or any error into a user-friendly message
      const message = getUserMediaErrorMessage(err);
      return new Error(message);
    }
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

    const ownStream = this.stream;

    // Stop tracks from our stored reference.
    if (ownStream) {
      for (const track of ownStream.getTracks()) {
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
