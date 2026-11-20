import type { Vec2 } from "./lib/homography";
import type { HandSide } from "./lib/tracker";

export const wallDetectionPluginId = "detection/wall" as const;

/** Result of the automatic screen mapping, persisted so it survives reloads. */
export type WallCalibration = {
  /** Camera pixels → normalised screen (viewport) coordinates, row-major 3×3. */
  homography: number[];
  /** Screen corners TL, TR, BR, BL in camera pixels. */
  corners: Vec2[];
  cameraWidth: number;
  cameraHeight: number;
  matchedDots: number;
  totalDots: number;
  /** Mean reprojection error on screen, in CSS pixels (null when only the coarse fit was used). */
  errorPx: number | null;
  /** Camera the mapping was made with (track label); empty for mappings saved before it existed. */
  cameraLabel?: string;
  createdAt: string;
};

export interface WallConfig {
  /** Which hand plays: the person's anatomical side. */
  hand: HandSide;
  /** Maximum number of people tracked at once. */
  maxPeople: number;
  /** Camera device; empty = browser default. */
  deviceId: string;
  /** Show the camera preview panel. */
  showPreview: boolean;
  calibration: WallCalibration | null;
}

export const defaultWallConfig: WallConfig = {
  hand: "right",
  maxPeople: 2,
  deviceId: "",
  showPreview: true,
  calibration: null,
};
