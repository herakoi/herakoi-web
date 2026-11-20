import { drawFingerFocus, type HandOverlayStyle } from "#src/plugins/detection/mediapipe/overlay";
import type { WallPointDetector } from "./WallPointDetector";

/** Large ring under each finger: on a wall-sized screen it shows where the hand is playing. */
const ringStyle: HandOverlayStyle = {
  focusColor: "rgba(235, 235, 235, 0.95)",
  focusFillColor: "rgba(220, 220, 220, 0.25)",
  focusWidth: 4,
  focusSize: 64,
  shadowColor: "rgba(0, 0, 0, 0.6)",
  shadowBlur: 10,
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
        drawFingerFocus(ctx, { x: point.x * canvas.width, y: point.y * canvas.height }, ringStyle);
      }
    }
  })();

  return () => {
    abortController.abort();
    clear();
  };
};
