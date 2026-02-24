export const mediaPipeDetectionPluginId = "detection/mediapipe" as const;

export interface MediaPipeConfig {
  mirror: boolean;
  maxHands: number;
  /** Device ID for getUserMedia. Empty string = browser default camera. */
  deviceId: string;
}

export const defaultMediaPipeConfig: MediaPipeConfig = {
  mirror: true,
  maxHands: 2,
  deviceId: "",
};
