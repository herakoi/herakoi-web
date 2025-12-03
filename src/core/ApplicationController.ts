/**
 * ApplicationController orchestrates the detect → sample → sonify pipeline.
 *
 * Why: We want the app shell to wire plugins together without knowing their
 * internals, so swapping detector/sampler/sonifier is just a construction-time
 * decision.
 * What: initialize/start the detector and sonifier, translate detected points
 * into sampled image data, and feed that map to the sonifier each frame.
 * How: subscribe to detector callbacks, sample at normalized coordinates, skip
 * null samples, and let the sonifier own lifecycle/cleanup via stop().
 */
import type { DetectedPoint, ImageSampler, Sonifier } from "#src/core/interfaces";

export class ApplicationController {
  constructor(
    private readonly detector: {
      initialize: () => Promise<void>;
      start: () => void;
      stop: () => void;
      onPointsDetected: (cb: (points: DetectedPoint[]) => void) => void;
    },
    private readonly sampler: ImageSampler,
    private readonly sonifier: Sonifier,
  ) {}

  async start(): Promise<void> {
    await this.detector.initialize();
    await this.sonifier.initialize();

    this.detector.onPointsDetected((points) => {
      const samples = new Map<string, NonNullable<ReturnType<ImageSampler["sampleAt"]>>>();

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

  async stop(): Promise<void> {
    this.detector.stop();
    this.sonifier.stop();
  }
}
