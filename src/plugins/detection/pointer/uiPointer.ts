import { drawFingerFocus, type HandOverlayStyle } from "#src/plugins/detection/mediapipe/overlay";
import type { PointerPointDetector } from "./PointerPointDetector";

const pointerFocusStyle: HandOverlayStyle = {
  focusColor: "rgba(215, 215, 215, 0.95)",
  focusFillColor: "rgba(210, 210, 210, 0.3)",
  focusWidth: 2,
  focusSize: 34,
  shadowColor: "rgba(210, 210, 210, 0.35)",
  shadowBlur: 8,
};

export const bindPointerUi = (detector: PointerPointDetector, canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const abortController = new AbortController();

  const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);

  void (async () => {
    for await (const points of detector.points(abortController.signal)) {
      clear();
      for (const point of points) {
        drawFingerFocus(
          ctx,
          { x: point.x * canvas.width, y: point.y * canvas.height },
          pointerFocusStyle,
        );
      }
    }
  })();

  return () => {
    abortController.abort();
    clear();
  };
};
