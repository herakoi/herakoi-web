import type { NormalizedLandmarkList } from "@mediapipe/hands";

export type FingerFocus = {
  x: number;
  y: number;
};

export const getFingerFocus = (
  handLandmarks: NormalizedLandmarkList,
  overlayWidth: number,
  overlayHeight: number,
): FingerFocus | null => {
  const indexTip = handLandmarks[8];
  if (!indexTip) {
    return null;
  }

  return {
    x: indexTip.x * overlayWidth,
    y: indexTip.y * overlayHeight,
  };
};
