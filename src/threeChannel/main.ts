import "./style.css";

import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { HAND_CONNECTIONS, type NormalizedLandmarkList, type Results } from "@mediapipe/hands";

import { HandsDetector } from "../vision/hands";

type NullableElement<T> = T | null;

const uploadInput = document.getElementById("upload") as NullableElement<HTMLInputElement>;
const videoElement = document.getElementById("input_video") as NullableElement<HTMLVideoElement>;
const canvasElement = document.getElementById("output_canvas") as NullableElement<HTMLCanvasElement>;
const imgCanvas = document.getElementById("imageCanvas") as NullableElement<HTMLCanvasElement>;
const overlayCanvas = document.getElementById("imageOverlay") as NullableElement<HTMLCanvasElement>;
const inputImage = document.getElementById("inputImage") as NullableElement<HTMLImageElement>;

const minFreqSlider = document.getElementById("min-freq") as NullableElement<HTMLInputElement>;
const maxFreqSlider = document.getElementById("max-freq") as NullableElement<HTMLInputElement>;
const minFreqValue = document.getElementById("min-freq-value");
const maxFreqValue = document.getElementById("max-freq-value");

if (
  !uploadInput ||
  !videoElement ||
  !canvasElement ||
  !imgCanvas ||
  !overlayCanvas ||
  !inputImage ||
  !minFreqSlider ||
  !maxFreqSlider ||
  !minFreqValue ||
  !maxFreqValue
) {
  throw new Error("Expected legacy markup to exist before bootstrapping the three-channel demo.");
}

const canvasCtx = canvasElement.getContext("2d");
const imgCtx = imgCanvas.getContext("2d");
const overlayCtx = overlayCanvas.getContext("2d");

if (!canvasCtx || !imgCtx || !overlayCtx) {
  throw new Error("Unable to acquire 2D contexts.");
}

let grayscaleData: ImageData | null = null;
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
let panner: StereoPannerNode | null = null;
let gainNode: GainNode | null = null;

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const cmax = Math.max(r, g, b);
  const cmin = Math.min(r, g, b);
  const delta = cmax - cmin;

  let h = 0;
  if (delta !== 0) {
    if (cmax === r) {
      h = 60 * (((g - b) / delta) % 6);
    } else if (cmax === g) {
      h = 60 * ((b - r) / delta + 2);
    } else {
      h = 60 * ((r - g) / delta + 4);
    }
  }
  if (h < 0) h += 360;

  const s = cmax === 0 ? 0 : (100 * delta) / cmax;
  const v = 100 * cmax;
  return [h, s, v];
}

function hueToFrequency(hue: number, minInput: number, maxInput: number, minOutput: number, maxOutput: number) {
  const normalized = (hue - minInput) / (maxInput - minInput);
  return minOutput + (maxOutput - minOutput) * normalized;
}

function brightnessToVolume(value: number, minInput: number, maxInput: number, minOutput: number, maxOutput: number) {
  const normalized = (value - minInput) / (maxInput - minInput);
  const logScale = Math.log10(1 + 9 * normalized);
  return minOutput + (maxOutput - minOutput) * logScale;
}

function saturationToPan(saturation: number, minInput: number, maxInput: number, minOutput: number, maxOutput: number) {
  const normalized = (saturation - minInput) / (maxInput - minInput);
  return minOutput + (maxOutput - minOutput) * normalized;
}

function playFrequency(freq: number, panValue = 0, volume = 0.5) {
  if (!oscillator) {
    oscillator = audioCtx.createOscillator();
    panner = audioCtx.createStereoPanner();
    gainNode = audioCtx.createGain();

    oscillator.type = "sine";
    oscillator.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(audioCtx.destination);

    oscillator.start();
  }

  if (!gainNode || !oscillator || !panner) {
    return;
  }

  gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
  oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
  panner.pan.setValueAtTime(panValue, audioCtx.currentTime);
}

function stopFrequency() {
  if (!oscillator || !gainNode) {
    return;
  }

  gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

  const shuttingDownOscillator = oscillator;
  const shuttingDownGain = gainNode;
  const shuttingDownPanner = panner;

  setTimeout(() => {
    shuttingDownOscillator?.stop();
    shuttingDownOscillator?.disconnect();
    shuttingDownGain?.disconnect();
    shuttingDownPanner?.disconnect();
    oscillator = null;
    gainNode = null;
    panner = null;
  }, 100);
}

hands.onResults((results: Results) => {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  imgCtx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
  imgCtx.drawImage(inputImage, 0, 0, imgCanvas.width, imgCanvas.height);
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  let handDetected = false;

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    handDetected = true;
    for (const handLms of results.multiHandLandmarks) {
      drawConnectors(canvasCtx, handLms, HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
      drawLandmarks(canvasCtx, handLms, { color: "#FF0000", lineWidth: 1 });

      const mirroredHandLms: NormalizedLandmarkList = handLms.map((landmark) => ({
        x: 1 - landmark.x,
        y: landmark.y,
        z: landmark.z,
      }));

      drawConnectors(overlayCtx, mirroredHandLms, HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
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

      if (grayscaleData) {
        const pixelX = Math.floor(x);
        const pixelY = Math.floor(y);

        if (
          pixelX >= 0 &&
          pixelX < overlayCanvas.width &&
          pixelY >= 0 &&
          pixelY < overlayCanvas.height
        ) {
          const i = (pixelY * overlayCanvas.width + pixelX) * 4;
          const hue = grayscaleData.data[i];
          const saturation = grayscaleData.data[i + 1];
          const brightness = grayscaleData.data[i + 2];

          const freq = hueToFrequency(hue / 255, 0, 1, minFreq, maxFreq);
          const distance = saturationToPan(saturation / 255, 0, 1, -1, 1);
          const volume = brightnessToVolume(brightness / 255, 0, 1, 0.1, 1);

          playFrequency(freq, distance, volume);

          overlayCtx.fillStyle = "white";
          overlayCtx.fillRect(x + 10, y - 30, 80, 20);
          overlayCtx.fillStyle = "black";
          overlayCtx.font = "12px sans-serif";
          overlayCtx.fillText(`${Math.round(freq)} Hz`, x + 15, y - 15);
        }
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

uploadInput.addEventListener("change", (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    if (!e.target?.result) {
      return;
    }

    inputImage.onload = () => {
      imgCtx.drawImage(inputImage, 0, 0, imgCanvas.width, imgCanvas.height);
      grayscaleData = imgCtx.getImageData(0, 0, imgCanvas.width, imgCanvas.height);
      const { data } = grayscaleData;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        const [h, s, v] = rgbToHsv(r, g, b);

        const croppedHue = h < 300 ? h : 0;
        data[i] = Math.round((croppedHue / 360) * 255);
        data[i + 1] = Math.round((s / 100) * 255);
        data[i + 2] = Math.round((v / 100) * 255);
      }
    };

    inputImage.src = e.target.result as string;
  };

  reader.readAsDataURL(file);
});

function setupCanvasSizes() {
  const width = 640;
  const height = 480;

  [canvasElement, imgCanvas, overlayCanvas].forEach((canvas) => {
    canvas.width = width;
    canvas.height = height;
  });
}

setupCanvasSizes();
window.addEventListener("resize", setupCanvasSizes);
