/**
 * MediaPipePointDetector implements the PointDetector interface by wrapping
 * MediaPipe Hands detection and a native getUserMedia camera loop.
 *
 * This adapter converts MediaPipe's hand landmarks into normalized DetectedPoint
 * coordinates, applying finger focus logic to emit only the index fingertip
 * position for each detected hand.
 *
 * Lifecycle:
 * 1. Constructor stores configuration
 * 2. initialize() creates MediaPipe Hands instance
 * 3. start() opens camera via NativeCamera and begins detection loop
 * 4. [detection runs] → onPointsDetected callbacks invoked with DetectedPoint[]
 * 5. stop() halts camera and detection
 */

import type { Hands, NormalizedLandmarkList, Options, Results } from "@mediapipe/hands";
import { CameraRestartError, CameraStartError } from "#src/core/domain-errors";
import type {
  DetectedPoint,
  ErrorOr,
  PointDetectionCallback,
  PointDetector,
} from "#src/core/interfaces";
import { createHands } from "#src/plugins/detection/mediapipe/hands";
import { useDeviceStore } from "./deviceStore";
import { NativeCamera } from "./NativeCamera";

/**
 * Callback for drawing hand landmarks visualization.
 */
export type HandsDrawerCallback = (landmarks: NormalizedLandmarkList[]) => void;

/**
 * Configuration for MediaPipePointDetector.
 */
export interface MediaPipePointDetectorConfig {
  /** Maximum number of hands to detect (1-4) */
  maxHands?: number;

  /** Additional MediaPipe Hands options */
  mediaPipeOptions?: Options;

  /** Mirror x-coordinates horizontally (useful for user-facing cameras) */
  mirrorX?: boolean;

  /** Specific video device ID. Empty/undefined = browser default. */
  deviceId?: string;

  /** Camera resolution width (default: 640) */
  cameraWidth?: number;

  /** Camera resolution height (default: 480) */
  cameraHeight?: number;
}

/**
 * Detects hand landmarks using MediaPipe and converts them to normalized points.
 *
 * Applies finger focus logic: only emits index fingertip position for each hand,
 * not all 21 landmarks. This matches the existing Herakoi behavior where each
 * hand produces one sonification point.
 */
export class MediaPipePointDetector implements PointDetector {
  private readonly videoElement: HTMLVideoElement;
  private readonly config: MediaPipePointDetectorConfig;

  private hands: Hands | null = null;
  private camera: NativeCamera | null = null;
  private callbacks: PointDetectionCallback[] = [];
  private drawers: HandsDrawerCallback[] = [];
  private initialized = false;
  private started = false;
  /** In-flight start promise used to dedupe concurrent start() calls. */
  private startInFlight: Promise<ErrorOr<undefined>> | null = null;
  /**
   * Set by stop() so a concurrent start() (e.g. React StrictMode double-invoke)
   * bails out instead of racing with a newer start() on the same video element.
   */
  private startAborted = false;

  constructor(videoElement: HTMLVideoElement, config: MediaPipePointDetectorConfig = {}) {
    this.videoElement = videoElement;
    this.config = config;
  }

  async initialize(): Promise<ErrorOr<undefined>> {
    if (this.initialized) {
      return;
    }

    try {
      // Create MediaPipe Hands with caller options
      const mediaPipeOptions: Options = {
        maxNumHands: this.config.maxHands ?? 2,
        ...this.config.mediaPipeOptions,
      };

      this.hands = createHands(mediaPipeOptions);

      // Register MediaPipe results handler
      this.hands.onResults((results) => this.handleResults(results));

      this.initialized = true;
    } catch (error) {
      return error instanceof Error ? error : new Error("Failed to initialize MediaPipe detector.");
    }
  }

  /**
   * Restart the camera with a new device ID.
   *
   * @returns The active facingMode reported by the new camera track, if available.
   */
  async restartCamera(deviceId?: string): Promise<ErrorOr<string | undefined>> {
    if (!this.initialized) {
      return new Error("MediaPipePointDetector must be initialized before restarting camera");
    }

    // Stop existing camera
    if (this.camera) {
      this.camera.stop();
      this.camera = null;
    }

    // Update config
    this.config.deviceId = deviceId;

    // Restart if we were running
    if (this.started) {
      this.camera = this.createCamera(deviceId);
      useDeviceStore.getState().setCameraOk();

      // Go-style error handling: camera.start() returns Error | void
      const result = await this.camera.start();

      if (result instanceof Error) {
        this.camera = null;
        useDeviceStore.getState().setCameraError(new CameraRestartError({ cause: result }));
        return result;
      }

      return this.camera.activeFacingMode;
    }

    return undefined;
  }

  /**
   * Returns the active facing mode from the current camera track.
   */
  getActiveFacingMode(): string | undefined {
    return this.camera?.activeFacingMode;
  }

  /**
   * Passthrough to NativeCamera.enumerateVideoDevices().
   */
  static enumerateDevices() {
    return NativeCamera.enumerateVideoDevices();
  }

  /**
   * Update mirror mode at runtime.
   */
  setMirror(mirrorX: boolean): void {
    this.config.mirrorX = mirrorX;
  }

  /**
   * Update the maximum number of hands MediaPipe should track at runtime.
   */
  setMaxHands(maxHands: number): void {
    this.config.maxHands = maxHands;
    if (this.hands) {
      this.hands.setOptions({ maxNumHands: maxHands });
    }
  }

  async start(): Promise<ErrorOr<undefined>> {
    if (!this.initialized) {
      return new Error("MediaPipePointDetector must be initialized before calling start()");
    }

    if (this.started) {
      return;
    }

    // Deduplicate concurrent starts on the same detector instance.
    if (this.startInFlight) {
      return this.startInFlight;
    }

    // Bail out if stop() was already called on this instance (e.g. React StrictMode
    // calls stop() while initialize() is still pending, then start() resumes here).
    if (this.startAborted) return;

    return this.startCameraWithDedupe();
  }

  stop(): void {
    // Set flag first so any in-flight start() sees it after its next await.
    this.startAborted = true;
    if (this.camera) {
      this.camera.stop();
      this.camera = null;
    }
    this.started = false;
  }

  onPointsDetected(callback: PointDetectionCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Register a callback for hand visualization (MediaPipe-specific).
   */
  onHandsDrawn(drawer: HandsDrawerCallback): void {
    this.drawers.push(drawer);
  }

  private handleResults(results: Results): void {
    const points: DetectedPoint[] = [];

    const landmarks = results.multiHandLandmarks || [];
    const workingLandmarks = this.config.mirrorX
      ? landmarks.map((hand) => this.mirrorLandmarks(hand))
      : landmarks;

    for (const drawer of this.drawers) {
      drawer(workingLandmarks);
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (let handIndex = 0; handIndex < workingLandmarks.length; handIndex++) {
        const handLandmarks = workingLandmarks[handIndex];
        const indexTip = handLandmarks[8];

        if (indexTip) {
          points.push({
            id: `hand-${handIndex}-index-tip`,
            x: indexTip.x,
            y: indexTip.y,
          });
        }
      }
    }

    for (const callback of this.callbacks) {
      callback(points);
    }
  }

  private mirrorLandmarks(landmarks: NormalizedLandmarkList): NormalizedLandmarkList {
    return landmarks.map((landmark) => ({
      ...landmark,
      x: 1 - landmark.x,
    })) as NormalizedLandmarkList;
  }

  private startCameraWithDedupe(): Promise<ErrorOr<undefined>> {
    this.startInFlight = this.startCameraFlow().finally(() => {
      this.startInFlight = null;
    });
    return this.startInFlight;
  }

  private async startCameraFlow(): Promise<ErrorOr<undefined>> {
    this.camera = this.createCamera(this.config.deviceId);
    useDeviceStore.getState().setCameraOk();

    // Go-style error handling: camera.start() returns Error | void
    const result = await this.camera.start();

    // If stop() fired while camera.start() was in progress, bail out.
    if (this.startAborted) {
      this.camera?.stop();
      this.camera = null;
      return;
    }

    // Handle error returned from camera.start()
    if (result instanceof Error) {
      useDeviceStore.getState().setCameraError(new CameraStartError({ cause: result }));
      return result;
    }

    this.started = true;
    return;
  }

  private createCamera(deviceId?: string): NativeCamera {
    return new NativeCamera(this.videoElement, {
      deviceId: deviceId || undefined,
      onFrame: async () => {
        if (this.hands) {
          await this.hands.send({ image: this.videoElement });
        }
      },
      width: this.config.cameraWidth ?? (this.videoElement.width || 640),
      height: this.config.cameraHeight ?? (this.videoElement.height || 480),
    });
  }
}
