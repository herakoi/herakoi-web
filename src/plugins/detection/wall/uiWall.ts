import { drawFingerFocus, type HandOverlayStyle } from "#src/plugins/detection/mediapipe/overlay";
import type { WallPointDetector } from "./WallPointDetector";

/**
 * Ring around each fingertip. On a wall-sized screen the hand covers whatever is right under the
 * finger, so the ring is large (about a hand wide) with a dark halo that reads on any image.
 */
const ringStyle: HandOverlayStyle = {
  focusColor: "rgba(255, 255, 255, 0.95)",
  focusFillColor: "rgba(255, 255, 255, 0.12)",
  focusWidth: 6,
  focusSize: 150,
  shadowColor: "rgba(0, 0, 0, 0.9)",
  shadowBlur: 14,
};
const dotStyle: HandOverlayStyle = {
  focusColor: "rgba(255, 255, 255, 1)",
  focusFillColor: "rgba(255, 255, 255, 0.9)",
  focusWidth: 2,
  focusSize: 14,
  shadowColor: "rgba(0, 0, 0, 0.9)",
  shadowBlur: 6,
};

export const bindWallUi = (detector: WallPointDetector, canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const abortController = new AbortController();
  const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);

  void (async () => {
    for await (const points of detector.points(abortController.signal)) {
      clear();
      for (const point of points) {
        const focus = { x: point.x * canvas.width, y: point.y * canvas.height };
        drawFingerFocus(ctx, focus, ringStyle);
        drawFingerFocus(ctx, focus, dotStyle);
      }
    }
  })();

  return () => {
    abortController.abort();
    clear();
  };
};
