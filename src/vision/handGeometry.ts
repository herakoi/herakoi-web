import type { NormalizedLandmarkList } from "@mediapipe/hands";

export const mirrorHandLandmarks = (
  handLandmarks: NormalizedLandmarkList,
): NormalizedLandmarkList =>
  handLandmarks.map((landmark) => ({
    x: 1 - landmark.x,
    y: landmark.y,
    z: landmark.z,
  }));

export type FingerFocus = {
  x: number;
  y: number;
};

export const getFingerFocus = (
  mirroredHandLandmarks: NormalizedLandmarkList,
  overlayWidth: number,
  overlayHeight: number,
): FingerFocus | null => {
  const indexTip = mirroredHandLandmarks[8];
  if (!indexTip) {
    return null;
  }

  return {
    x: indexTip.x * overlayWidth,
    y: indexTip.y * overlayHeight,
  };
};
