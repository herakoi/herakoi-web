# Camera Capture Alternative (Improvement Note)

## Why
We want to decouple hands detection from the `@mediapipe/camera_utils` helper so we can control constraints explicitly, shrink dependencies, and keep the modular pipeline flexible for future detectors or devices. Browsers already expose `getUserMedia` plus per-frame callbacks, so we can drive MediaPipe Hands without the Camera wrapper.

## What
Implement a native capture loop inside `MediaPipePointDetector` that:
1. Requests video with `navigator.mediaDevices.getUserMedia` using our facing mode and resolution.
2. Attaches the stream to the existing `<video>` element and calls `video.play()`.
3. Uses `requestVideoFrameCallback` (falling back to `requestAnimationFrame`) to send each frame to `hands.send({ image: videoElement })`.
4. Stops tracks and re-requests media when facing mode changes, mirroring the current `restartCamera` behavior.

## How (expected behavior/steps)
- Initialize:
  - Call `getUserMedia({ video: { facingMode, width, height } })`.
  - Set `videoEl.srcObject = stream`, await `videoEl.play()`.
  - Start a `processFrame` loop:
    - On each callback, call `await hands.send({ image: videoEl })`.
    - Reschedule via `videoEl.requestVideoFrameCallback(processFrame)`; if unavailable, use `requestAnimationFrame(processFrame)`.
- Start/stop:
  - `start()` kicks off the frame loop if initialized; `stop()` cancels the loop and stops all media tracks.
- Restart facing mode:
  - Stop current tracks, request a new stream with the updated `facingMode`, reattach, and resume the loop.
- Mirror handling:
  - Keep the existing `mirrorX` logic; the detector still flips landmark coordinates, so overlays stay in sync.

## Risks / Mitigations
- **Permission UX:** getUserMedia prompts the user; we mitigate by reusing existing permission flows and surfacing errors in the status label.
- **API support:** `requestVideoFrameCallback` is widely available in modern browsers; we keep a `requestAnimationFrame` fallback.
- **Track leaks:** ensure `stop()` always stops active tracks and clears the loop to avoid camera LED staying on.

## Next Step
Replace the `@mediapipe/camera_utils` usage in `src/detection/mediapipe/MediaPipePointDetector.ts` with this native loop, keeping the public detector interface unchanged.*** End Patch]];
