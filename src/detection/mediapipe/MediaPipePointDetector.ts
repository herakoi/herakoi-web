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
 * 2. initialize() creates HandsDetector and Camera instances
 * 3. start() begins camera/detection loop
 * 4. [detection runs] → onPointsDetected callbacks invoked with DetectedPoint[]
 * 5. stop() halts camera and detection
 */

import { Camera } from "@mediapipe/camera_utils";
import type { NormalizedLandmarkList, Options, Results } from "@mediapipe/hands";
import type { DetectedPoint, PointDetectionCallback, PointDetector } from "#src/core/interfaces";
import { HandsDetector } from "#src/vision/hands";

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
 * Configuration for MediaPipePointDetector.
 */
export interface MediaPipePointDetectorConfig {
  /** Maximum number of hands to detect (1-4) */
  maxHands?: number;

  /** Additional MediaPipe Hands options */
  mediaPipeOptions?: Options;
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

  private handsDetector: HandsDetector | null = null;
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

    // Create HandsDetector with MediaPipe options
    const mediaPipeOptions: Options = {
      maxNumHands: this.config.maxHands ?? 2,
      ...this.config.mediaPipeOptions,
    };

    this.handsDetector = new HandsDetector(mediaPipeOptions);

    // Register MediaPipe results handler
    const handsInstance = this.handsDetector.getInstance();
    handsInstance.onResults((results) => this.handleResults(results));

    // Create Camera with onFrame callback that sends frames to MediaPipe
    this.camera = new Camera(this.videoElement, {
      onFrame: async () => {
        if (this.handsDetector) {
          await this.handsDetector.getInstance().send({ image: this.videoElement });
        }
      },
      width: this.videoElement.width || 640,
      height: this.videoElement.height || 480,
    });

    this.initialized = true;
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
   * - Generate unique ID for each hand's index finger
   *
   * @param results MediaPipe Hands detection results
   */
  private handleResults(results: Results): void {
    const points: DetectedPoint[] = [];

    // Always call visualization drawers on every frame (even if no hands detected)
    // This allows drawers to clear previous frames
    const landmarks = results.multiHandLandmarks || [];
    for (const drawer of this.drawers) {
      drawer(landmarks);
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      // Process each detected hand
      for (let handIndex = 0; handIndex < results.multiHandLandmarks.length; handIndex++) {
        const handLandmarks = results.multiHandLandmarks[handIndex];

        // Finger focus: use index finger tip (landmark 8)
        // https://github.com/google/mediapipe/blob/master/docs/solutions/hands.md#hand-landmark-model
        const indexTip = handLandmarks[8];

        if (indexTip) {
          points.push({
            id: `hand-${handIndex}-index-tip`,
            x: indexTip.x, // Already normalized 0-1
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
}
