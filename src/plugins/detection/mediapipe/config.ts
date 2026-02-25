export const mediaPipeDetectionPluginId = "detection/mediapipe" as const;

export interface MediaPipeConfig {
  maxHands: number;
}

export const defaultMediaPipeConfig: MediaPipeConfig = {
  maxHands: 2,
};
