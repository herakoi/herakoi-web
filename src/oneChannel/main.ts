import "./style.css";

import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { HAND_CONNECTIONS, type NormalizedLandmarkList, type Results } from "@mediapipe/hands";
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
let uploadedImage: HTMLImageElement | null = null;

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

const audioCtxCtor =
  window.AudioContext ||
  (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

if (!audioCtxCtor) {
  throw new Error("Web Audio API is not available in this browser.");
}

const audioCtx = new audioCtxCtor();
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;

function playFrequency(freq: number, volume = 0.5) {
  if (!oscillator) {
    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();

    oscillator.type = "sine";
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
  }

  if (!gainNode || !oscillator) {
    return;
  }

  gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
  oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
}

function stopFrequency() {
  if (!oscillator || !gainNode) {
    return;
  }

  gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

  const shuttingDownOscillator = oscillator;
  const shuttingDownGain = gainNode;

  setTimeout(() => {
    shuttingDownOscillator?.stop();
    shuttingDownOscillator?.disconnect();
    shuttingDownGain?.disconnect();
    oscillator = null;
    gainNode = null;
  }, 100);
}

hands.onResults((results: Results) => {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  // We leave the user's uploaded image intact between frames; only new uploads repaint it.
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  let handDetected = false;

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    handDetected = true;
    for (const handLms of results.multiHandLandmarks) {
      drawConnectors(canvasCtx, handLms, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 2,
      });
      drawLandmarks(canvasCtx, handLms, { color: "#FF0000", lineWidth: 1 });

      const mirroredHandLms: NormalizedLandmarkList = handLms.map((landmark) => ({
        x: 1 - landmark.x,
        y: landmark.y,
        z: landmark.z,
      }));

      drawConnectors(overlayCtx, mirroredHandLms, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 2,
      });
      drawLandmarks(overlayCtx, mirroredHandLms, { color: "#FF0000", lineWidth: 1 });

      const indexTip = mirroredHandLms[8];
      if (!indexTip) {
        continue;
      }
      const x = indexTip.x * overlayCanvas.width;
      const y = indexTip.y * overlayCanvas.height;
      const boxSize = 20;

      overlayCtx.strokeStyle = "lime";
      overlayCtx.lineWidth = 2;
      overlayCtx.strokeRect(x - boxSize / 2, y - boxSize / 2, boxSize, boxSize);

      const pixelX = Math.floor(x);
      const pixelY = Math.floor(y);

      const pixelSample = imageSampler?.sampleAtPixel(pixelX, pixelY);
      if (pixelSample) {
        const freq = minFreq + (pixelSample.hueByte / 255) * (maxFreq - minFreq);
        const volume = minVol + (pixelSample.valueByte / 255) * (maxVol - minVol);
        playFrequency(freq, volume);

        overlayCtx.fillStyle = "white";
        overlayCtx.fillRect(x + 10, y - 30, 80, 20);
        overlayCtx.fillStyle = "black";
        overlayCtx.font = "12px sans-serif";
        overlayCtx.fillText(`${Math.round(freq)} Hz`, x + 15, y - 15);
      }
    }
  }

  if (!handDetected) {
    stopFrequency();
  }

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

  const _targetSize = { width: imgCanvas.width, height: imgCanvas.height };

  const imgElement = inputImage ?? new Image();
  const objectUrl = URL.createObjectURL(file);

  imgElement.onload = () => {
    URL.revokeObjectURL(objectUrl);
    uploadedImage = imgElement;
    imgCtx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
    imgCtx.drawImage(uploadedImage, 0, 0, imgCanvas.width, imgCanvas.height);

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
