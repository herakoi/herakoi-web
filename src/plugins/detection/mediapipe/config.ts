export const mediaPipeDetectionPluginId = "detection/mediapipe" as const;

export type MediaPipeFacingMode = "user" | "environment";

export interface MediaPipeConfig {
  mirror: boolean;
  maxHands: number;
  facingMode: MediaPipeFacingMode;
}

export const defaultMediaPipeConfig: MediaPipeConfig = {
  mirror: true,
  maxHands: 2,
  facingMode: "user",
};
