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
import type { DetectedPoint } from "#src/core/interfaces";
import {
  drawFingerFocus,
  drawHands,
  type HandOverlayStyle,
} from "#src/detection/mediapipe/overlay";
import type { MediaPipePointDetector } from "./MediaPipePointDetector";

type OverlayTarget = {
  canvas: HTMLCanvasElement;
  style?: HandOverlayStyle;
  getPointStyle?: (point: DetectedPoint) => HandOverlayStyle | undefined;
};

type OverlayTargetWithCtx = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  style: HandOverlayStyle | undefined;
  getPointStyle: ((point: DetectedPoint) => HandOverlayStyle | undefined) | undefined;
};

type OverlayInput = HTMLCanvasElement | OverlayTarget;

const normalizeOverlay = (overlay: OverlayInput): OverlayTarget =>
  "canvas" in overlay ? overlay : { canvas: overlay };

export function bindHandsUi(detector: MediaPipePointDetector, overlays: OverlayInput[]): void {
  const targets = overlays
    .map((overlay) => {
      const { canvas, style, getPointStyle } = normalizeOverlay(overlay);
      const ctx = canvas.getContext("2d");
      return ctx ? ({ canvas, ctx, style, getPointStyle } satisfies OverlayTargetWithCtx) : null;
    })
    .filter((entry): entry is OverlayTargetWithCtx => entry !== null);

  detector.onHandsDrawn((landmarks) => {
    for (const { canvas, ctx } of targets) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    for (const hand of landmarks) {
      drawHands(targets.map(({ ctx, style }) => ({ ctx, landmarks: hand, style })));
    }
  });

  detector.onPointsDetected((points) => {
    for (const point of points) {
      for (const { canvas, ctx, style, getPointStyle } of targets) {
        const pixelX = point.x * canvas.width;
        const pixelY = point.y * canvas.height;
        const focusStyle = getPointStyle?.(point) ?? style;
        drawFingerFocus(ctx, { x: pixelX, y: pixelY }, focusStyle);
      }
    }
  });
}
