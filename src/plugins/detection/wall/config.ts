import type { Vec2 } from "./lib/homography";
import type { HandSide, PlayTarget } from "./lib/tracker";

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
  /** Camera selection the mapping was made with (device id, "" = default camera). Not the track
   * label: some browsers give the default camera a new random label on every start. */
  cameraId?: string;
  /** Viewport size (CSS px) while mapping; the mapping only holds for the same layout. */
  viewportWidth?: number;
  viewportHeight?: number;
  createdAt: string;
};

export interface WallConfig {
  /** Which hand plays: the person's anatomical side. */
  hand: HandSide;
  /** Point of the hand that plays: palm centre (steadier, default) or index fingertip. */
  playWith: PlayTarget;
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
  playWith: "palm",
  maxPeople: 2,
  deviceId: "",
  showPreview: true,
  calibration: null,
};
