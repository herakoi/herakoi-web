import { MediaPipePointDetector } from "#src/detection/mediapipe/MediaPipePointDetector";
import type { DetectorControls } from "#src/detection/mediapipe/uiControls";

let detectorSingleton: MediaPipePointDetector | null = null;

export function getMediaPipeDetector(controls: DetectorControls): MediaPipePointDetector {
  if (!detectorSingleton) {
    const { state, elements } = controls;
    detectorSingleton = new MediaPipePointDetector(elements.videoElement, {
      maxHands: state.maxHands,
      mirrorX: state.isMirrored,
      facingMode: state.facingMode,
      mediaPipeOptions: {
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      },
    });
    controls.attach(detectorSingleton);
  }
  return detectorSingleton;
}
