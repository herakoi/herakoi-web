/**
 * ApplicationController keeps the detect → sample → sonify loop in one place.
 *
 * Why: We want `main.ts` to stay a thin bootstrap while the core loop remains
 * reusable across entrypoints. This controller wires any PointDetector,
 * ImageSampler, and Sonifier so we can swap implementations without editing
 * orchestration code.
 *
 * What: It initializes detector and sonifier, subscribes to detection events,
 * collects samples from the sampler, and forwards them to the sonifier every
 * frame. An empty sample map tells the sonifier to stop playing.
 *
 * How: The detector streams normalized points via callback. For each point we
 * sample the image, gather successful samples into a Map keyed by point id,
 * and pass that Map straight to the sonifier.
 */
import type { ImageSample, ImageSampler, PointDetector, Sonifier } from "#src/core/interfaces";

export class ApplicationController {
  constructor(
    private readonly detector: PointDetector,
    private readonly sampler: ImageSampler,
    private readonly sonifier: Sonifier,
  ) {}

  /**
   * Start the pipeline after dependencies are ready.
   *
   * We initialize detector + sonifier up front so downstream callbacks know
   * resources exist. Then we subscribe to detection events before starting
   * the detector to avoid missing the first frame.
   */
  async start(): Promise<void> {
    await this.detector.initialize();
    await this.sonifier.initialize();

    this.detector.onPointsDetected((points) => {
      const samples = new Map<string, ImageSample>();

      for (const point of points) {
        const sample = this.sampler.sampleAt(point);
        if (sample) {
          samples.set(point.id, sample);
        }
      }

      this.sonifier.processSamples(samples);
    });

    this.detector.start();
  }

  /**
   * Stop the pipeline and release resources.
   *
   * We stop detection first so callbacks cease, then silence audio. Repeated
   * calls are safe because underlying implementations already guard state.
   */
  stop(): void {
    this.detector.stop();
    this.sonifier.stop();
  }
}
