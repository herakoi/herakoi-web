/**
 * MediaPipePointDetector implements the PointDetector interface by wrapping
 * MediaPipe Hands detection and Camera utilities.
 *
 * This adapter converts MediaPipe's hand landmarks into normalized DetectedPoint
 * coordinates, applying finger focus logic to emit only the index fingertip
 * position for each detected hand.
 *
 * Lifecycle:
 * 1. Constructor stores configuration
 * 2. initialize() creates MediaPipe Hands and Camera instances
 * 3. start() begins camera/detection loop
 * 4. [detection runs] → onPointsDetected callbacks invoked with DetectedPoint[]
 * 5. stop() halts camera and detection
 */

import { Camera } from "@mediapipe/camera_utils";
import type { Hands, NormalizedLandmarkList, Options, Results } from "@mediapipe/hands";
import type { DetectedPoint, PointDetectionCallback, PointDetector } from "#src/core/interfaces";
import { createHands } from "#src/plugins/detection/mediapipe/hands";

/**
 * Callback for drawing hand landmarks visualization.
 *
 * MediaPipePointDetector-specific extension that allows consumers to render
 * the full hand skeleton (all 21 landmarks) without polluting the core
 * PointDetector interface.
 *
 * @param landmarks Array of hand landmark arrays (one per detected hand)
 */
export type HandsDrawerCallback = (landmarks: NormalizedLandmarkList[]) => void;

/**
 * Camera facing mode for video input.
 */
export type FacingMode = "user" | "environment";

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

  /** Camera facing mode ("user" for front camera, "environment" for rear) */
  facingMode?: FacingMode;

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
  private camera: Camera | null = null;
  private callbacks: PointDetectionCallback[] = [];
  private drawers: HandsDrawerCallback[] = [];
  private initialized = false;
  private started = false;

  constructor(videoElement: HTMLVideoElement, config: MediaPipePointDetectorConfig = {}) {
    this.videoElement = videoElement;
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create MediaPipe Hands with caller options
    const mediaPipeOptions: Options = {
      maxNumHands: this.config.maxHands ?? 2,
      ...this.config.mediaPipeOptions,
    };

    this.hands = createHands(mediaPipeOptions);

    // Register MediaPipe results handler
    this.hands.onResults((results) => this.handleResults(results));

    // Create Camera with onFrame callback that sends frames to MediaPipe
    this.camera = this.createCamera(this.config.facingMode ?? "user");

    this.initialized = true;
  }

  /**
   * Restart the camera with a new facing mode.
   *
   * Allows switching between front ("user") and rear ("environment") cameras
   * without recreating the entire detector.
   *
   * @param facingMode New camera facing mode
   * @throws Error if not initialized or if camera fails to restart
   */
  async restartCamera(facingMode: FacingMode): Promise<void> {
    if (!this.initialized) {
      throw new Error("MediaPipePointDetector must be initialized before restarting camera");
    }

    // Stop existing camera
    if (this.camera) {
      try {
        await this.camera.stop();
      } catch (error) {
        console.warn("Failed to stop existing camera:", error);
      }
    }

    // Update config
    this.config.facingMode = facingMode;

    // Create new camera with new facing mode
    this.camera = this.createCamera(facingMode);

    // Restart camera if we were already started
    if (this.started) {
      try {
        await this.camera.start();
      } catch (error) {
        console.error("Failed to start new camera:", error);
        throw error;
      }
    }
  }

  /**
   * Update mirror mode at runtime so UI toggles can keep overlays aligned with the video.
   *
   * We only flip the in-memory config; the next MediaPipe result cycle will
   * apply the mirrored coordinates without needing to recreate the detector.
   *
   * @param mirrorX Whether to mirror x-coordinates for selfie-style rendering
   */
  setMirror(mirrorX: boolean): void {
    this.config.mirrorX = mirrorX;
  }

  /**
   * Update the maximum number of hands MediaPipe should track at runtime.
   *
   * MediaPipe Hands supports changing `maxNumHands` via setOptions, so we
   * propagate the new limit without tearing down the detector.
   *
   * @param maxHands Maximum hands to track (1-8; MediaPipe clamps internally)
   */
  setMaxHands(maxHands: number): void {
    this.config.maxHands = maxHands;
    if (this.hands) {
      this.hands.setOptions({ maxNumHands: maxHands });
    }
  }

  start(): void {
    if (!this.initialized) {
      throw new Error("MediaPipePointDetector must be initialized before calling start()");
    }

    if (this.started) {
      return; // Already started, ignore duplicate call
    }

    if (!this.camera) {
      throw new Error("Camera not initialized");
    }

    // Start camera (which triggers onFrame loop)
    void this.camera.start();
    this.started = true;
  }

  stop(): void {
    if (!this.started) {
      return; // Not started, nothing to stop
    }

    if (this.camera) {
      this.camera.stop();
    }
    this.started = false;
  }

  onPointsDetected(callback: PointDetectionCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Register a callback for hand visualization (MediaPipe-specific).
   *
   * The drawer receives the full hand landmarks (all 21 points per hand)
   * for rendering hand skeleton, connections, etc. This is separate from
   * the core PointDetector interface to keep it detector-agnostic.
   *
   * @param drawer Function to invoke with full hand landmark arrays
   */
  onHandsDrawn(drawer: HandsDrawerCallback): void {
    this.drawers.push(drawer);
  }

  /**
   * Handles MediaPipe detection results and converts to DetectedPoint format.
   *
   * Applies finger focus logic:
   * - For each detected hand, extract only the index fingertip (landmark 8)
   * - Convert to normalized coordinates (MediaPipe already provides 0-1 range)
   * - Apply mirroring transformation if configured
   * - Generate unique ID for each hand's index finger
   *
   * @param results MediaPipe Hands detection results
   */
  private handleResults(results: Results): void {
    const points: DetectedPoint[] = [];

    // Apply mirroring to landmarks if configured
    const landmarks = results.multiHandLandmarks || [];
    const workingLandmarks = this.config.mirrorX
      ? landmarks.map((hand) => this.mirrorLandmarks(hand))
      : landmarks;

    // Always call visualization drawers on every frame (even if no hands detected)
    // This allows drawers to clear previous frames
    for (const drawer of this.drawers) {
      drawer(workingLandmarks);
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      // Process each detected hand
      for (let handIndex = 0; handIndex < workingLandmarks.length; handIndex++) {
        const handLandmarks = workingLandmarks[handIndex];

        // Finger focus: use index finger tip (landmark 8)
        // https://github.com/google/mediapipe/blob/master/docs/solutions/hands.md#hand-landmark-model
        const indexTip = handLandmarks[8];

        if (indexTip) {
          points.push({
            id: `hand-${handIndex}-index-tip`,
            x: indexTip.x, // Already normalized 0-1 and mirrored if configured
            y: indexTip.y, // Already normalized 0-1
          });
        }
      }
    }

    // Invoke all registered callbacks
    for (const callback of this.callbacks) {
      callback(points);
    }
  }

  /**
   * Mirror landmarks horizontally for selfie-camera effect.
   */
  private mirrorLandmarks(landmarks: NormalizedLandmarkList): NormalizedLandmarkList {
    return landmarks.map((landmark) => ({
      ...landmark,
      x: 1 - landmark.x,
    })) as NormalizedLandmarkList;
  }

  private createCamera(facingMode: FacingMode): Camera {
    return new Camera(this.videoElement, {
      onFrame: async () => {
        if (this.hands) {
          await this.hands.send({ image: this.videoElement });
        }
      },
      width: this.config.cameraWidth ?? (this.videoElement.width || 640),
      height: this.config.cameraHeight ?? (this.videoElement.height || 480),
      facingMode,
    });
  }
}
