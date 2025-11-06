import "./style.css";

import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import {
  HAND_CONNECTIONS,
  Hands,
  type NormalizedLandmarkList,
  type Results,
} from "@mediapipe/hands";
import handFullModelUrl from "@mediapipe/hands/hand_landmark_full.tflite?url";
import handLiteModelUrl from "@mediapipe/hands/hand_landmark_lite.tflite?url";
import handsGraphUrl from "@mediapipe/hands/hands.binarypb?url";
import handsAssetsDataUrl from "@mediapipe/hands/hands_solution_packed_assets.data?url";
import handsAssetsLoaderUrl from "@mediapipe/hands/hands_solution_packed_assets_loader.js?url";
import handsSimdScriptUrl from "@mediapipe/hands/hands_solution_simd_wasm_bin.js?url";
import handsSimdWasmUrl from "@mediapipe/hands/hands_solution_simd_wasm_bin.wasm?url";
import handsWasmScriptUrl from "@mediapipe/hands/hands_solution_wasm_bin.js?url";
import handsWasmUrl from "@mediapipe/hands/hands_solution_wasm_bin.wasm?url";

type HandsFileKey =
  | "hands_solution_packed_assets_loader.js"
  | "hands_solution_packed_assets.data"
  | "hands_solution_simd_wasm_bin.js"
  | "hands_solution_simd_wasm_bin.wasm"
  | "hands_solution_wasm_bin.js"
  | "hands_solution_wasm_bin.wasm"
  | "hand_landmark_full.tflite"
  | "hand_landmark_lite.tflite"
  | "hands.binarypb";

const mediaPipeAssets = new Map<HandsFileKey, string>([
  ["hands_solution_packed_assets_loader.js", handsAssetsLoaderUrl],
  ["hands_solution_packed_assets.data", handsAssetsDataUrl],
  ["hands_solution_simd_wasm_bin.js", handsSimdScriptUrl],
  ["hands_solution_simd_wasm_bin.wasm", handsSimdWasmUrl],
  ["hands_solution_wasm_bin.js", handsWasmScriptUrl],
  ["hands_solution_wasm_bin.wasm", handsWasmUrl],
  ["hand_landmark_full.tflite", handFullModelUrl],
  ["hand_landmark_lite.tflite", handLiteModelUrl],
  ["hands.binarypb", handsGraphUrl],
]);

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

const hands = new Hands({
  locateFile: (file) => {
    const localUrl = mediaPipeAssets.get(file as HandsFileKey);
    if (!localUrl) {
      throw new Error(`Missing MediaPipe asset mapping for "${file}".`);
    }
    return localUrl;
  },
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

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

  imgCtx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
  imgCtx.drawImage(inputImage, 0, 0, imgCanvas.width, imgCanvas.height);
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
          const freq = minFreq + (hue / 255) * (maxFreq - minFreq);

          const brightness = grayscaleData.data[i + 2];
          const volume = minVol + (brightness / 255) * (maxVol - minVol);
          playFrequency(freq, volume);

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
    if (!e.target?.result) return;
    inputImage.onload = () => {
      imgCtx.drawImage(inputImage, 0, 0, imgCanvas.width, imgCanvas.height);

      grayscaleData = imgCtx.getImageData(0, 0, imgCanvas.width, imgCanvas.height);
      const { data } = grayscaleData;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

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

        const v = cmax;
        const hByte = Math.round((h / 360) * 255);
        const vByte = Math.round(v * 255);

        data[i] = hByte;
        data[i + 1] = hByte;
        data[i + 2] = vByte;
      }
    };

    inputImage.src = e.target.result as string;
  };
  reader.readAsDataURL(file);
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
