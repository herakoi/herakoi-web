/**
 * MediaPipe-specific hands UI wiring.
 *
 * Why: Only the MediaPipe detector supplies full hand landmarks and fingertip points,
 * so we centralize the overlay drawing here instead of scattering callbacks across
 * entrypoints that might use mouse or touch detectors.
 * What: Bind onHandsDrawn for skeleton rendering and onPointsDetected for fingertip
 * focus markers, clearing every provided overlay each frame.
 * How: Call bindHandsUi with the detector and an array of overlays; we iterate all of
 * them so MediaPipe hands render wherever the caller wants (video, image, etc.).
 */
import { drawFingerFocus, drawHands } from "#src/canvas/overlay";
import type { MediaPipePointDetector } from "./MediaPipePointDetector";

export function bindHandsUi(detector: MediaPipePointDetector, overlays: HTMLCanvasElement[]): void {
  const targets = overlays
    .map((canvas) => {
      const ctx = canvas.getContext("2d");
      return ctx ? { canvas, ctx } : null;
    })
    .filter(
      (entry): entry is { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => !!entry,
    );

  detector.onHandsDrawn((landmarks) => {
    for (const { canvas, ctx } of targets) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    for (const hand of landmarks) {
      drawHands(targets.map(({ ctx }) => ({ ctx, landmarks: hand })));
    }
  });

  detector.onPointsDetected((points) => {
    for (const point of points) {
      for (const { canvas, ctx } of targets) {
        const pixelX = point.x * canvas.width;
        const pixelY = point.y * canvas.height;
        drawFingerFocus(ctx, { x: pixelX, y: pixelY });
      }
    }
  });
}
