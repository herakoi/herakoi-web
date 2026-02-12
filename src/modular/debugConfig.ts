/**
 * Debug tooling stays near the modular entrypoint but in its own module so we
 * can swap or disable panels without touching the main wiring.
 *
 * NOTE: Debug functionality has been moved to the visualizer plugin system.
 * This module is kept for backward compatibility with deprecated code.
 */

import type { DetectedPoint } from "#src/core/interfaces";
import { drawFrequencyLabel } from "#src/detection/mediapipe/overlay";

// Stub types and values for backward compatibility
export type DebugToneSample = {
  toneId: string;
  frequency: number;
  volume: number;
  hueByte: number;
  saturationByte: number;
  valueByte: number;
};

const isDev = false; // Debug functionality now controlled via visualizer plugin

export const debugTools = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  logToneSamples: (_samples: DebugToneSample[]) => {
    // No-op: debug functionality moved to visualizer plugin
  },
};

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

type OverlayForDebug = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

/**
 * In dev builds we mirror the debug HUD by sketching the computed frequency
 * next to each fingertip on the provided overlay canvas. We keep this wiring
 * here so the main entrypoint stays focused on production concerns.
 */
export const attachDevFrequencyLabels = (
  detector: { onPointsDetected: (cb: (points: DetectedPoint[]) => void) => void },
  sampler: { sampleAt: (point: DetectedPoint) => unknown | null },
  oscillatorState: { minFreq: number; maxFreq: number },
  overlay: OverlayForDebug,
  isSamplerReady: () => boolean,
): void => {
  if (!isDev) return;

  detector.onPointsDetected((points) => {
    for (let handIndex = 0; handIndex < points.length; handIndex += 1) {
      const point = points[handIndex];
      const sample = isSamplerReady() ? sampler.sampleAt(point) : null;
      if (!sample) {
        continue;
      }

      const hueByte = (sample as { data: { hueByte?: number } | undefined }).data?.hueByte ?? 0;
      const frequency =
        oscillatorState.minFreq +
        (hueByte / 255) * (oscillatorState.maxFreq - oscillatorState.minFreq);

      const imagePixelX = point.x * overlay.canvas.width;
      const imagePixelY = point.y * overlay.canvas.height;
      drawFrequencyLabel(overlay.ctx, { x: imagePixelX, y: imagePixelY }, frequency, handIndex);
    }
  });
};
