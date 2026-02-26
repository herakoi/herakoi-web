/**
 * Core interfaces for the Herakoi detection → sampling → sonification engine.
 *
 * These interfaces define the contracts between modules:
 * - PointDetector: Tracks points (e.g., fingertips) in normalized coordinates
 * - ImageSampler: Samples image data at detected points
 * - Sonifier: Converts image samples to audio
 *
 * Design principles:
 * - Normalized coordinates (0-1) for detector output
 * - Flexible key-value image data (supports different color spaces)
 * - Async initialization for heavy resources (models, audio context)
 * - AsyncIterable-based detection streaming
 */

/**
 * Represents a detected point in normalized coordinate space.
 *
 * Coordinates are normalized to 0-1 range where:
 * - (0, 0) = top-left corner
 * - (1, 1) = bottom-right corner
 *
 * This normalization makes detectors resolution-independent and simplifies
 * coordinate mapping to images of different sizes.
 */
export interface DetectedPoint {
  /** Unique identifier for this point (e.g., "hand-0-index-tip") */
  id: string;

  /** Normalized x-coordinate (0-1, left to right) */
  x: number;

  /** Normalized y-coordinate (0-1, top to bottom) */
  y: number;
}

/**
 * Go-style result type where failures are returned as Error values.
 *
 * Success is represented by T (or undefined for void-style operations).
 */
export type ErrorOr<T> = Error | T;

/**
 * Detects points of interest (e.g., hand landmarks, face features) from video input.
 *
 * Implementations wrap different detection backends (MediaPipe, TensorFlow, etc.)
 * and emit normalized point coordinates via async stream.
 *
 * Lifecycle:
 * 1. construct → 2. initialize() → 3. start() → 4. consume points() → 5. stop()
 */
export interface PointDetector {
  /**
   * Initialize detection resources (load models, create camera).
   *
   * This async operation may take several seconds for model loading.
   * Must be called before start().
   *
   */
  initialize(): Promise<ErrorOr<undefined>>;

  /**
   * Start the detection loop.
   *
   * Begins processing video frames.
   * Requires initialize() to have completed successfully.
   *
   */
  start(): ErrorOr<undefined> | Promise<ErrorOr<undefined>>;

  /**
   * Stop the detection loop and release resources.
   *
   * Safe to call multiple times. After stopping, can restart with start().
   */
  stop(): void;

  /** Stream point batches emitted by this detector over time. */
  points(signal?: AbortSignal): AsyncIterable<DetectedPoint[]>;
}

/**
 * Image sample data extracted at a specific point.
 *
 * Uses flexible key-value structure to support different color spaces and
 * feature representations. Common keys:
 * - "hue": 0-360 degrees
 * - "saturation": 0-100 percent
 * - "value": 0-100 percent (brightness)
 * - "red", "green", "blue": 0-255
 *
 * Implementations define which keys they provide and consumers select
 * the keys they need.
 */
export interface ImageSample {
  /**
   * Flexible key-value pairs for image features.
   *
   * Keys and value ranges are implementation-defined but should be documented.
   * Numeric values allow direct mapping to audio parameters.
   */
  data: Record<string, number>;
}

/**
 * Samples image data at specified coordinates.
 *
 * Implementations handle image loading, coordinate mapping (normalized to pixel),
 * and feature extraction (color space conversion, brightness calculation, etc.).
 *
 * Design supports pre-computation strategies where expensive operations
 * (like RGB→HSV conversion) happen once at load time.
 */
export interface ImageSampler {
  /**
   * Load an image for sampling.
   *
   * @param source Image source (URL, HTMLImageElement, canvas, etc.)
   */
  loadImage(source: string | HTMLImageElement | HTMLCanvasElement): Promise<ErrorOr<undefined>>;

  /**
   * Sample image data for detected points.
   *
   * Converts normalized coordinates to pixel coordinates and extracts features
   * for each point. Points out of bounds or unavailable are skipped.
   *
   * @param points Detected points with normalized coordinates
   * @returns Map of point ID -> sample data, or Error on runtime failure
   */
  sampleAt(points: DetectedPoint[]): ErrorOr<Map<string, ImageSample>>;
}

/**
 * Configuration options for sonifier behavior.
 *
 * Allows runtime adjustment of audio parameters without recreating the sonifier.
 */
export interface SonifierOptions {
  /** Oscillator waveform type */
  oscillatorType?: OscillatorType;

  /** Master volume (0-1) */
  volume?: number;

  /** Fade-out duration in seconds when tones stop */
  fadeOutDuration?: number;
}

/**
 * Converts image samples to audio output.
 *
 * Manages Web Audio API resources, maps sample data to audio parameters
 * (frequency, volume, pan), and handles tone lifecycle (start/update/stop).
 *
 * Design supports multiple simultaneous tones (one per detected point) with
 * smooth transitions and cleanup.
 */
export interface Sonifier {
  /**
   * Initialize audio resources (create AudioContext, nodes).
   *
   * Must be called before processSamples(). Some browsers require user gesture
   * before AudioContext can start.
   *
   */
  initialize(): Promise<ErrorOr<undefined>>;

  /**
   * Process image samples and update audio output.
   *
   * Called on each frame with current samples. Sonifier creates/updates/stops
   * tones based on which point IDs are present vs previous frame.
   *
   * @param samples Map of point ID → image sample for currently detected points
   */
  processSamples(samples: Map<string, ImageSample>): ErrorOr<undefined>;

  /**
   * Stop all audio and release resources.
   *
   * Safe to call multiple times. After stopping, can reinitialize if needed.
   */
  stop(): void;

  /**
   * Update sonifier configuration at runtime.
   *
   * Changes take effect on next processSamples() call. Existing tones may
   * be updated immediately depending on implementation.
   *
   * @param options Partial configuration to merge with current settings
   */
  configure(options: SonifierOptions): void;
}
