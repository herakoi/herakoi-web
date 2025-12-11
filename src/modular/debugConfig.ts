/**
 * Debug tooling stays near the modular entrypoint but in its own module so we
 * can swap or disable panels without touching the main wiring.
 */

import type { DetectedPoint } from "#src/core/interfaces";
import { type DebugToneSample, setupDebugTools } from "#src/debug";

export const debugTools = setupDebugTools();
export type { DebugToneSample };

export const buildDebugToneLogger =
  (
    sampler: { sampleAt: (point: DetectedPoint) => unknown | null },
    oscillatorState: {
      minFreq: number;
      maxFreq: number;
      minVol: number;
      maxVol: number;
    },
    isSamplerReady: () => boolean,
  ) =>
  (points: DetectedPoint[]): void => {
    const debugToneSamples: DebugToneSample[] = [];

    for (const point of points) {
      if (!isSamplerReady()) {
        continue;
      }

      const sample = sampler.sampleAt(point) as {
        data: {
          hueByte?: number;
          saturationByte?: number;
          valueByte?: number;
        };
      } | null;
      if (sample) {
        const hueByte = sample.data.hueByte ?? 0;
        const valueByte = sample.data.valueByte ?? 0;
        const frequency =
          oscillatorState.minFreq +
          (hueByte / 255) * (oscillatorState.maxFreq - oscillatorState.minFreq);
        const volume =
          oscillatorState.minVol +
          (valueByte / 255) * (oscillatorState.maxVol - oscillatorState.minVol);
        debugToneSamples.push({
          toneId: point.id,
          frequency,
          volume,
          hueByte,
          saturationByte: sample.data.saturationByte ?? 0,
          valueByte,
        });
      }
    }

    debugTools.logToneSamples(debugToneSamples);
  };
