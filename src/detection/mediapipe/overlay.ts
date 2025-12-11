import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { HAND_CONNECTIONS, type NormalizedLandmarkList } from "@mediapipe/hands";

export type FingerFocus = {
  x: number;
  y: number;
};

export type HandOverlayLayer = {
  ctx: CanvasRenderingContext2D;
  landmarks: NormalizedLandmarkList;
};

export function drawHands(layers: HandOverlayLayer[]): void {
  for (const { ctx, landmarks } of layers) {
    drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
      color: "#00FF00",
      lineWidth: 2,
    });
    drawLandmarks(ctx, landmarks, { color: "#FF0000", lineWidth: 1 });
  }
}

export function drawFingerFocus(ctx: CanvasRenderingContext2D, focus: FingerFocus): void {
  const boxSize = 20;
  ctx.strokeStyle = "lime";
  ctx.lineWidth = 2;
  ctx.strokeRect(focus.x - boxSize / 2, focus.y - boxSize / 2, boxSize, boxSize);
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
