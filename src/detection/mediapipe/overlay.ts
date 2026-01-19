import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { HAND_CONNECTIONS, type NormalizedLandmarkList } from "@mediapipe/hands";

export type FingerFocus = {
  x: number;
  y: number;
};

export type HandOverlayLayer = {
  ctx: CanvasRenderingContext2D;
  landmarks: NormalizedLandmarkList;
  style?: HandOverlayStyle;
};

export type HandOverlayStyle = {
  connectorColor?: string;
  connectorWidth?: number;
  landmarkColor?: string;
  landmarkWidth?: number;
  focusColor?: string;
  focusFillColor?: string;
  focusWidth?: number;
  focusSize?: number;
  shadowColor?: string;
  shadowBlur?: number;
};

export function drawHands(layers: HandOverlayLayer[]): void {
  for (const { ctx, landmarks, style } of layers) {
    const connectorColor = style?.connectorColor ?? "#00FF00";
    const connectorWidth = style?.connectorWidth ?? 2;
    const landmarkColor = style?.landmarkColor ?? "#FF0000";
    const landmarkWidth = style?.landmarkWidth ?? 1;

    ctx.save();
    if (style?.shadowColor) {
      ctx.shadowColor = style.shadowColor;
      ctx.shadowBlur = style.shadowBlur ?? 0;
    }
    drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
      color: connectorColor,
      lineWidth: connectorWidth,
    });
    drawLandmarks(ctx, landmarks, { color: landmarkColor, lineWidth: landmarkWidth });
    ctx.restore();
  }
}

export function drawFingerFocus(
  ctx: CanvasRenderingContext2D,
  focus: FingerFocus,
  style?: HandOverlayStyle,
): void {
  const boxSize = style?.focusSize ?? 20;
  const radius = boxSize / 2;
  ctx.save();
  if (style?.shadowColor) {
    ctx.shadowColor = style.shadowColor;
    ctx.shadowBlur = style.shadowBlur ?? 0;
  }
  if (style?.focusFillColor) {
    ctx.fillStyle = style.focusFillColor;
    ctx.beginPath();
    ctx.arc(focus.x, focus.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = style?.focusColor ?? "lime";
  ctx.lineWidth = style?.focusWidth ?? 2;
  ctx.beginPath();
  ctx.arc(focus.x, focus.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawFrequencyLabel(
  overlayCtx: CanvasRenderingContext2D,
  focus: FingerFocus,
  frequency: number,
  handIndex: number,
): void {
  overlayCtx.fillStyle = "white";
  overlayCtx.fillRect(focus.x + 10, focus.y - 30, 100, 20);
  overlayCtx.fillStyle = "black";
  overlayCtx.font = "12px sans-serif";
  overlayCtx.fillText(`${Math.round(frequency)} Hz - ${handIndex}`, focus.x + 15, focus.y - 15);
}
