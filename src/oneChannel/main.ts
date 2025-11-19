import "./style.css";

import { Camera } from "@mediapipe/camera_utils";
import type { Results } from "@mediapipe/hands";
import { Sonifier, type ToneUpdate } from "#src/audio/sonification";
import { drawFingerFocus, drawFrequencyLabel, drawHands } from "#src/canvas/overlay";
import { type DebugToneSample, setupDebugTools } from "#src/debug/index";
import { getFingerFocus, mirrorHandLandmarks } from "#src/vision/handGeometry";
import { HandsDetector } from "#src/vision/hands";
import { ImageSampler } from "#src/vision/imageEncoding";

const uploadInput = document.getElementById("upload") as HTMLInputElement | null;
const videoElement = document.getElementById("input_video") as HTMLVideoElement | null;
const canvasElement = document.getElementById("output_canvas") as HTMLCanvasElement | null;
const imgCanvas = document.getElementById("imageCanvas") as HTMLCanvasElement | null;
const overlayCanvas = document.getElementById("imageOverlay") as HTMLCanvasElement | null;
const inputImage = document.getElementById("inputImage") as HTMLImageElement | null;

if (
  !uploadInput ||
  !videoElement ||
  !canvasElement ||
  !imgCanvas ||
  !overlayCanvas ||
  !inputImage
) {
  throw new Error("Expected legacy markup to exist before bootstrapping the test app.");
}

const canvasCtx = canvasElement.getContext("2d");
const imgCtx = imgCanvas.getContext("2d");
const overlayCtx = overlayCanvas.getContext("2d");

if (!canvasCtx || !imgCtx || !overlayCtx) {
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

if (
  !minFreqSlider ||
  !maxFreqSlider ||
  !minFreqValue ||
  !maxFreqValue ||
  !minVolSlider ||
  !maxVolSlider ||
  !minVolValue ||
  !maxVolValue
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

/*
 * We reuse HandsDetector so our MediaPipe asset wiring stays centralized with src/vision/hands.ts.
 * It hands back the underlying Hands instance, so this file keeps the same callback flow the legacy HTML used.
 * That shared helper also ensures any future asset or option tweaks land everywhere at once.
 */
const handsDetector = new HandsDetector({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});
const hands = handsDetector.getInstance();

const sonifier = new Sonifier();
const debugTools = setupDebugTools();
const overlayContext = {
  baseCtx: canvasCtx,
  overlayCtx,
};

hands.onResults((results: Results) => {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  // We leave the user's uploaded image intact between frames; only new uploads repaint it.
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  const toneUpdates: ToneUpdate[] = [];
  const debugToneSamples: DebugToneSample[] = [];

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    for (const [handIndex, handLms] of results.multiHandLandmarks.entries()) {
      const mirroredHandLms = mirrorHandLandmarks(handLms);
      drawHands(overlayContext, handLms, mirroredHandLms);

      const fingerFocus = getFingerFocus(
        mirroredHandLms,
        overlayCanvas.width,
        overlayCanvas.height,
      );
      if (!fingerFocus) {
        continue;
      }

      drawFingerFocus(overlayCtx, fingerFocus);

      const pixelX = Math.floor(fingerFocus.x);
      const pixelY = Math.floor(fingerFocus.y);

      const pixelSample = imageSampler?.sampleAtPixel(pixelX, pixelY);
      if (pixelSample) {
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
        drawFrequencyLabel(overlayCtx, fingerFocus, freq, handIndex);
      }
    }
  }

  sonifier.syncTones(toneUpdates);
  debugTools.logToneSamples(debugToneSamples);

  canvasCtx.restore();
});

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480,
});
camera.start();

// We pass the raw file straight to ImageSampler so it owns decoding, scaling, and byte encoding.
// That keeps main focused on wiring callbacks rather than managing canvases or pixel math.
uploadInput.addEventListener("change", (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) {
    return;
  }

  const imgElement = inputImage ?? new Image();
  const objectUrl = URL.createObjectURL(file);

  imgElement.onload = () => {
    URL.revokeObjectURL(objectUrl);
    imgCtx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
    imgCtx.drawImage(imgElement, 0, 0, imgCanvas.width, imgCanvas.height);

    // Build the sampler only after the image is actually drawn, so we encode real pixels.
    imageSampler = new ImageSampler(imgCanvas);
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

  const canvases = [canvasElement, imgCanvas, overlayCanvas].filter(
    (canvas): canvas is HTMLCanvasElement => canvas instanceof HTMLCanvasElement,
  );

  for (const canvas of canvases) {
    canvas.width = width;
    canvas.height = height;
  }
}

setupCanvasSizes();
window.addEventListener("resize", setupCanvasSizes);
