import "./style.css";

import { Camera } from "@mediapipe/camera_utils";
import type { NormalizedLandmarkList, Results } from "@mediapipe/hands";
import { Sonifier, type ToneUpdate } from "#src/audio/sonification";
import { drawFingerFocus, drawFrequencyLabel, drawHands } from "#src/canvas/overlay";
import { type DebugToneSample, setupDebugTools } from "#src/debug/index";
import { getFingerFocus } from "#src/vision/handGeometry";
import { HandsDetector } from "#src/vision/hands";
import { ImageSampler } from "#src/vision/imageEncoding";

const imageUploadInput = document.getElementById("upload") as HTMLInputElement | null;
const cameraVideoElement = document.getElementById("input_video") as HTMLVideoElement | null;
const videoHandsOverlayCanvas = document.getElementById(
  "output_canvas",
) as HTMLCanvasElement | null;
const sourceImageCanvas = document.getElementById("imageCanvas") as HTMLCanvasElement | null;
const imageOverlayCanvas = document.getElementById("imageOverlay") as HTMLCanvasElement | null;
const uploadedImageElement = document.getElementById("inputImage") as HTMLImageElement | null;

if (
  !imageUploadInput ||
  !cameraVideoElement ||
  !videoHandsOverlayCanvas ||
  !sourceImageCanvas ||
  !imageOverlayCanvas ||
  !uploadedImageElement
) {
  throw new Error("Expected legacy markup to exist before bootstrapping the test app.");
}

const videoHandsOverlayCtx = videoHandsOverlayCanvas.getContext("2d");
const imgCtx = sourceImageCanvas.getContext("2d");
const imageOverlayCtx = imageOverlayCanvas.getContext("2d");

if (!videoHandsOverlayCtx || !imgCtx || !imageOverlayCtx) {
  throw new Error("Unable to acquire 2D canvas contexts.");
}

const minFreqSlider = document.getElementById("min-freq") as HTMLInputElement | null;
const maxFreqSlider = document.getElementById("max-freq") as HTMLInputElement | null;
const minFreqValue = document.getElementById("min-freq-value");
const maxFreqValue = document.getElementById("max-freq-value");

const minVolSlider = document.getElementById("min-vol") as HTMLInputElement | null;
const maxVolSlider = document.getElementById("max-vol") as HTMLInputElement | null;
const minVolValue = document.getElementById("min-vol-value");
const maxVolValue = document.getElementById("max-vol-value");
const mirrorToggleButton = document.getElementById("mirror-toggle") as HTMLButtonElement | null;
const maxHandsSlider = document.getElementById("max-hands") as HTMLInputElement | null;
const maxHandsValue = document.getElementById("max-hands-value");
const oscillatorTypeSelect = document.getElementById("oscillator-type") as HTMLSelectElement | null;
const cameraFacingSelect = document.getElementById("camera-facing") as HTMLSelectElement | null;

if (
  !minFreqSlider ||
  !maxFreqSlider ||
  !minFreqValue ||
  !maxFreqValue ||
  !minVolSlider ||
  !maxVolSlider ||
  !minVolValue ||
  !maxVolValue ||
  !mirrorToggleButton ||
  !maxHandsSlider ||
  !maxHandsValue ||
  !oscillatorTypeSelect ||
  !cameraFacingSelect
) {
  throw new Error("Expected frequency and volume controls to be present.");
}

let imageSampler: ImageSampler | null = null;

let minFreq = Number(minFreqSlider.value) || 200;
let maxFreq = Number(maxFreqSlider.value) || 700;

minFreqSlider.addEventListener("input", (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  minFreq = value;
  minFreqValue.textContent = String(value);
});

maxFreqSlider.addEventListener("input", (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  maxFreq = value;
  maxFreqValue.textContent = String(value);
});

let minVol = Number(minVolSlider.value) || 0;
let maxVol = Number(maxVolSlider.value) || 0.3;
let isMirrored = document.body.classList.contains("is-mirrored");
let maxHands = Number(maxHandsSlider.value) || 4;
const initialOscType = (oscillatorTypeSelect.value || "sine") as OscillatorType;
type FacingMode = "user" | "environment";
let currentFacingMode: FacingMode = (cameraFacingSelect.value as FacingMode) || "user";

maxHandsValue.textContent = String(maxHands);

minVolSlider.addEventListener("input", (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  minVol = value;
  minVolValue.textContent = value.toFixed(2);
});

maxVolSlider.addEventListener("input", (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  maxVol = value;
  maxVolValue.textContent = value.toFixed(2);
});

const setMirrorState = (nextState: boolean) => {
  isMirrored = nextState;
  document.body.classList.toggle("is-mirrored", isMirrored);
  mirrorToggleButton.textContent = isMirrored ? "Disable mirror mode" : "Enable mirror mode";
};

mirrorToggleButton.addEventListener("click", () => {
  setMirrorState(!isMirrored);
});

setMirrorState(isMirrored);

/*
 * We reuse HandsDetector so our MediaPipe asset wiring stays centralized with src/vision/hands.ts.
 * It hands back the underlying Hands instance, so this file keeps the same callback flow the legacy HTML used.
 * That shared helper also ensures any future asset or option tweaks land everywhere at once.
 */
const handsDetector = new HandsDetector({
  maxNumHands: maxHands,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});
const hands = handsDetector.getInstance();
hands.setOptions({ maxNumHands: maxHands });

let camera: Camera | null = null;

const sonifier = new Sonifier();
sonifier.setOscillatorType(initialOscType);
const debugTools = setupDebugTools();

hands.onResults((results: Results) => {
  videoHandsOverlayCtx.save();
  imageOverlayCtx.save();
  videoHandsOverlayCtx.clearRect(
    0,
    0,
    videoHandsOverlayCanvas.width,
    videoHandsOverlayCanvas.height,
  );
  // this draw replicate the video image. since we have the video element tied to the camera, it's not needed to draw again.
  // we keep this line as reference in the case we want to follow a different approach to show the camera output
  // videoHandsOverlayCtx.drawImage(
  //   results.image,
  //   0,
  //   0,
  //   videoHandsOverlayCanvas.width,
  //   videoHandsOverlayCanvas.height,
  // );

  imageOverlayCtx.clearRect(0, 0, imageOverlayCanvas.width, imageOverlayCanvas.height);

  const toneUpdates: ToneUpdate[] = [];
  const debugToneSamples: DebugToneSample[] = [];

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    for (const [handIndex, handLms] of results.multiHandLandmarks.entries()) {
      const workingLandmarks = isMirrored ? mirrorLandmarks(handLms) : handLms;
      drawHands([
        { ctx: videoHandsOverlayCtx, landmarks: workingLandmarks },
        { ctx: imageOverlayCtx, landmarks: workingLandmarks },
      ]);

      const fingerFocus = getFingerFocus(
        workingLandmarks,
        imageOverlayCanvas.width,
        imageOverlayCanvas.height,
      );
      if (!fingerFocus) {
        continue;
      }

      drawFingerFocus(imageOverlayCtx, fingerFocus);

      const pixelX = Math.floor(fingerFocus.x);
      const pixelY = Math.floor(fingerFocus.y);

      const boundedPixelX = Math.max(0, Math.min(imageOverlayCanvas.width - 1, pixelX));
      const boundedPixelY = Math.max(0, Math.min(imageOverlayCanvas.height - 1, pixelY));
      const pixelSample = imageSampler?.sampleAtPixel(boundedPixelX, boundedPixelY);
      if (!pixelSample) {
        continue;
      }
      const freq = minFreq + (pixelSample.hueByte / 255) * (maxFreq - minFreq);
      const volume = minVol + (pixelSample.valueByte / 255) * (maxVol - minVol);

      const toneId = `hand-${handIndex}-index-tip`;
      toneUpdates.push({ id: toneId, params: { frequency: freq, volume } });
      debugToneSamples.push({
        toneId,
        frequency: freq,
        volume,
        hueByte: pixelSample.hueByte,
        valueByte: pixelSample.valueByte,
      });
      drawFrequencyLabel(imageOverlayCtx, fingerFocus, freq, handIndex);
    }
  }

  sonifier.syncTones(toneUpdates);
  debugTools.logToneSamples(debugToneSamples);

  imageOverlayCtx.restore();
  videoHandsOverlayCtx.restore();
});

const startCamera = async (facingMode: FacingMode) => {
  currentFacingMode = facingMode;
  cameraFacingSelect.value = facingMode;

  if (camera) {
    try {
      await camera.stop();
    } catch (error) {
      console.warn("Failed to stop existing camera", error);
    }
  }

  camera = new Camera(cameraVideoElement, {
    onFrame: async () => {
      await hands.send({ image: cameraVideoElement });
    },
    width: 640,
    height: 480,
    facingMode,
  });

  try {
    await camera.start();
  } catch (error) {
    console.error("Failed to start camera", error);
  }
};

void startCamera(currentFacingMode);

// We pass the raw file straight to ImageSampler so it owns decoding, scaling, and byte encoding.
// That keeps main focused on wiring callbacks rather than managing canvases or pixel math.
imageUploadInput.addEventListener("change", (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) {
    return;
  }

  const imgElement = uploadedImageElement ?? new Image();
  const objectUrl = URL.createObjectURL(file);

  imgElement.onload = () => {
    URL.revokeObjectURL(objectUrl);
    imgCtx.clearRect(0, 0, sourceImageCanvas.width, sourceImageCanvas.height);
    imgCtx.drawImage(imgElement, 0, 0, sourceImageCanvas.width, sourceImageCanvas.height);

    // Build the sampler only after the image is actually drawn, so we encode real pixels.
    imageSampler = new ImageSampler(sourceImageCanvas);
  };

  imgElement.onerror = (error) => {
    URL.revokeObjectURL(objectUrl);
    console.error("Failed to load image element for display", error);
  };

  imgElement.src = objectUrl;
});

function setupCanvasSizes() {
  const width = 640;
  const height = 480;

  const canvases = [videoHandsOverlayCanvas, sourceImageCanvas, imageOverlayCanvas].filter(
    (canvas): canvas is HTMLCanvasElement => canvas instanceof HTMLCanvasElement,
  );

  for (const canvas of canvases) {
    canvas.width = width;
    canvas.height = height;
  }
}

setupCanvasSizes();
window.addEventListener("resize", setupCanvasSizes);

function mirrorLandmarks(landmarks: NormalizedLandmarkList): NormalizedLandmarkList {
  return landmarks.map((landmark) => ({
    ...landmark,
    x: 1 - landmark.x,
  })) as NormalizedLandmarkList;
}
maxHandsSlider.addEventListener("input", (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  maxHands = Math.max(1, Math.min(8, value));
  maxHandsValue.textContent = String(maxHands);
  hands.setOptions({ maxNumHands: maxHands });
});

oscillatorTypeSelect.addEventListener("change", (event) => {
  const nextType = (event.target as HTMLSelectElement).value as OscillatorType;
  sonifier.setOscillatorType(nextType);
});

cameraFacingSelect.addEventListener("change", (event) => {
  const nextFacing = ((event.target as HTMLSelectElement).value as FacingMode) || "user";
  void startCamera(nextFacing);
});
