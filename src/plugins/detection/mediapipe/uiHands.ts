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

import type { NormalizedLandmarkList } from "@mediapipe/hands";
import type { DetectedPoint } from "#src/core/interfaces";
import {
  drawFingerFocus,
  drawHands,
  type HandOverlayStyle,
} from "#src/plugins/detection/mediapipe/overlay";
import type { MediaPipePointDetector } from "./MediaPipePointDetector";

type HandFitMode = "fill" | "contain" | "cover";

type HandSourceSize = {
  width: number;
  height: number;
};

type OverlayTarget = {
  canvas: HTMLCanvasElement;
  style?: HandOverlayStyle;
  getPointStyle?: (point: DetectedPoint) => HandOverlayStyle | undefined;
  sourceSize?: HandSourceSize | (() => HandSourceSize | null);
  fitMode?: HandFitMode;
};

type OverlayTargetWithCtx = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  style: HandOverlayStyle | undefined;
  getPointStyle: ((point: DetectedPoint) => HandOverlayStyle | undefined) | undefined;
  sourceSize: HandSourceSize | (() => HandSourceSize | null) | undefined;
  fitMode: HandFitMode;
};

type OverlayInput = HTMLCanvasElement | OverlayTarget;

const normalizeOverlay = (overlay: OverlayInput): OverlayTarget =>
  "canvas" in overlay ? overlay : { canvas: overlay };

const resolveSourceSize = (
  sourceSize: HandSourceSize | (() => HandSourceSize | null) | undefined,
): HandSourceSize | null => {
  if (!sourceSize) return null;
  if (typeof sourceSize === "function") {
    return sourceSize();
  }
  return sourceSize;
};

const mapNormalizedPoint = (
  x: number,
  y: number,
  canvas: HTMLCanvasElement,
  sourceSize: HandSourceSize | (() => HandSourceSize | null) | undefined,
  fitMode: HandFitMode,
) => {
  const resolvedSource = resolveSourceSize(sourceSize);
  if (!resolvedSource || fitMode === "fill") {
    return { x, y };
  }

  const srcW = resolvedSource.width;
  const srcH = resolvedSource.height;
  const dstW = canvas.width;
  const dstH = canvas.height;
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    return { x, y };
  }

  const scale =
    fitMode === "cover" ? Math.max(dstW / srcW, dstH / srcH) : Math.min(dstW / srcW, dstH / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const offsetX = (dstW - drawW) / 2;
  const offsetY = (dstH - drawH) / 2;

  const px = offsetX + x * srcW * scale;
  const py = offsetY + y * srcH * scale;

  return { x: px / dstW, y: py / dstH };
};

const mapLandmarks = (
  landmarks: NormalizedLandmarkList,
  canvas: HTMLCanvasElement,
  sourceSize: HandSourceSize | (() => HandSourceSize | null) | undefined,
  fitMode: HandFitMode,
): NormalizedLandmarkList => {
  return landmarks.map((landmark) => {
    const projected = mapNormalizedPoint(landmark.x, landmark.y, canvas, sourceSize, fitMode);
    return {
      ...landmark,
      x: projected.x,
      y: projected.y,
    };
  }) as NormalizedLandmarkList;
};

export function bindHandsUi(detector: MediaPipePointDetector, overlays: OverlayInput[]): void {
  const targets = overlays
    .map((overlay) => {
      const { canvas, style, getPointStyle, sourceSize, fitMode } = normalizeOverlay(overlay);
      const ctx = canvas.getContext("2d");
      return ctx
        ? ({
            canvas,
            ctx,
            style,
            getPointStyle,
            sourceSize,
            fitMode: fitMode ?? "fill",
          } satisfies OverlayTargetWithCtx)
        : null;
    })
    .filter((entry): entry is OverlayTargetWithCtx => entry !== null);

  detector.onHandsDrawn((landmarks) => {
    for (const { canvas, ctx } of targets) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    for (const hand of landmarks) {
      drawHands(
        targets.map(({ ctx, style, canvas, sourceSize, fitMode }) => ({
          ctx,
          landmarks: mapLandmarks(hand, canvas, sourceSize, fitMode),
          style,
        })),
      );
    }
  });

  detector.onPointsDetected((points) => {
    for (const point of points) {
      for (const { canvas, ctx, style, getPointStyle, sourceSize, fitMode } of targets) {
        const projected = mapNormalizedPoint(point.x, point.y, canvas, sourceSize, fitMode);
        const pixelX = projected.x * canvas.width;
        const pixelY = projected.y * canvas.height;
        const focusStyle = getPointStyle?.(point) ?? style;
        drawFingerFocus(ctx, { x: pixelX, y: pixelY }, focusStyle);
      }
    }
  });
}
