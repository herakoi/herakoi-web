/**
 * Modular Herakoi Implementation
 *
 * We keep this entrypoint focused on wiring: load the image once, size the
 * canvases, and hand control to ApplicationController so the detect → sample
 * → sonify loop stays swappable. UI controls mirror the one-channel demo while
 * letting us swap detector/sampler/sonifier implementations later.
 */

import { drawFingerFocus, drawHands } from "#src/canvas/overlay";
import { ApplicationController } from "#src/core/ApplicationController";
import { type DebugToneSample, setupDebugTools } from "#src/debug";
import {
  type FacingMode,
  MediaPipePointDetector,
} from "#src/detection/mediapipe/MediaPipePointDetector";
import { HSVImageSampler } from "#src/sampling/HSVImageSampler";
import { OscillatorSonifier } from "#src/sonification/OscillatorSonifier";
import "./style.css";

import zodiacConstellationsUrl from "../assets/zodiac-constellations.jpg?url";

// --- DOM helpers ------------------------------------------------------------

const requireElement = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Modular page missing #${id}`);
  return el as T;
};

const statusLabel = requireElement<HTMLSpanElement>("modular-status");
const videoElement = requireElement<HTMLVideoElement>("modular-video");
const videoOverlayCanvas = requireElement<HTMLCanvasElement>("modular-video-overlay");
const imageCanvas = requireElement<HTMLCanvasElement>("modular-image");
const imageOverlayCanvas = requireElement<HTMLCanvasElement>("modular-image-overlay");
const imageInput = requireElement<HTMLInputElement>("modular-image-upload");

const minFreqSlider = requireElement<HTMLInputElement>("modular-min-freq");
const maxFreqSlider = requireElement<HTMLInputElement>("modular-max-freq");
const minFreqValue = requireElement<HTMLSpanElement>("modular-min-freq-value");
const maxFreqValue = requireElement<HTMLSpanElement>("modular-max-freq-value");
const minVolSlider = requireElement<HTMLInputElement>("modular-min-vol");
const maxVolSlider = requireElement<HTMLInputElement>("modular-max-vol");
const minVolValue = requireElement<HTMLSpanElement>("modular-min-vol-value");
const maxVolValue = requireElement<HTMLSpanElement>("modular-max-vol-value");
const mirrorToggleButton = requireElement<HTMLButtonElement>("modular-mirror-toggle");
const maxHandsSlider = requireElement<HTMLInputElement>("modular-max-hands");
const maxHandsValue = requireElement<HTMLSpanElement>("modular-max-hands-value");
const oscillatorTypeSelect = requireElement<HTMLSelectElement>("modular-oscillator-type");
const cameraFacingSelect = requireElement<HTMLSelectElement>("modular-camera-facing");

const videoOverlayCtx = videoOverlayCanvas.getContext("2d") as CanvasRenderingContext2D;
const imageOverlayCtx = imageOverlayCanvas.getContext("2d") as CanvasRenderingContext2D;
const imageCtx = imageCanvas.getContext("2d") as CanvasRenderingContext2D;

// --- State ------------------------------------------------------------------

let isMirrored = document.body.classList.contains("is-mirrored");
let minFreq = Number(minFreqSlider.value) || 200;
let maxFreq = Number(maxFreqSlider.value) || 700;
let minVol = Number(minVolSlider.value) / 100 || 0;
let maxVol = Number(maxVolSlider.value) / 100 || 0.2;
let maxHands = Number(maxHandsSlider.value) || 2;
const initialOscType = (oscillatorTypeSelect.value || "sine") as OscillatorType;
const initialFacingMode: FacingMode = (cameraFacingSelect.value as FacingMode) || "user";

const sampler = new HSVImageSampler();
const sonifier = new OscillatorSonifier(undefined, {
  minFreq,
  maxFreq,
  minVol,
  maxVol,
  oscillatorType: initialOscType,
  fadeMs: 120,
});
const detector = new MediaPipePointDetector(videoElement, {
  maxHands,
  mirrorX: isMirrored,
  facingMode: initialFacingMode,
  mediaPipeOptions: {
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  },
});
const controller = new ApplicationController(detector, sampler, sonifier);
const debugTools = setupDebugTools();

let samplerReady = false;

// --- Canvas sizing ----------------------------------------------------------

const FALLBACK_CANVAS_WIDTH = 640;
const PANEL_ASPECT_RATIO = 4 / 3;
const FALLBACK_CANVAS_HEIGHT = Math.round(FALLBACK_CANVAS_WIDTH / PANEL_ASPECT_RATIO);

const measureCanvasSize = (canvas: HTMLCanvasElement) => {
  const parentRect = canvas.parentElement?.getBoundingClientRect();
  const rect = parentRect && parentRect.width > 0 ? parentRect : canvas.getBoundingClientRect();
  const width = Math.round(rect.width) || FALLBACK_CANVAS_WIDTH;
  const height =
    Math.round(rect.height) || Math.round(width / PANEL_ASPECT_RATIO) || FALLBACK_CANVAS_HEIGHT;
  return { width, height };
};

function resizeCanvases() {
  [videoOverlayCanvas, imageCanvas, imageOverlayCanvas].forEach((canvas) => {
    const { width, height } = measureCanvasSize(canvas);
    canvas.width = width;
    canvas.height = height;
  });

  if (samplerReady && defaultImage.complete) {
    drawImageToCanvas(defaultImage);
  }
}

// --- Image loading ----------------------------------------------------------

const defaultImage = new Image();
defaultImage.crossOrigin = "anonymous";
defaultImage.src = zodiacConstellationsUrl;

function drawImageToCanvas(img: HTMLImageElement) {
  imageCanvas.width = img.naturalWidth || 640;
  imageCanvas.height = img.naturalHeight || 480;
  imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
  imageCtx.drawImage(img, 0, 0, imageCanvas.width, imageCanvas.height);
}

async function loadSamplerFromImage(img: HTMLImageElement) {
  drawImageToCanvas(img);
  await sampler.loadImage(imageCanvas);
  samplerReady = true;
  statusLabel.textContent = "Image loaded and ready for sampling";
}

defaultImage.onload = async () => {
  await loadSamplerFromImage(defaultImage);
};

defaultImage.onerror = () => {
  statusLabel.textContent = "Failed to load default image";
};

imageInput.addEventListener("change", (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = async () => {
    await loadSamplerFromImage(img);
    URL.revokeObjectURL(url);
  };
  img.onerror = () => {
    statusLabel.textContent = "Failed to load custom image";
    URL.revokeObjectURL(url);
  };
  img.src = url;
});

// --- Detection wiring -------------------------------------------------------

detector.onHandsDrawn((landmarks) => {
  videoOverlayCtx.clearRect(0, 0, videoOverlayCanvas.width, videoOverlayCanvas.height);
  imageOverlayCtx.clearRect(0, 0, imageOverlayCanvas.width, imageOverlayCanvas.height);
  for (const hand of landmarks) {
    drawHands([
      { ctx: videoOverlayCtx, landmarks: hand },
      { ctx: imageOverlayCtx, landmarks: hand },
    ]);
  }
});

/*
 * We keep fingertip highlights in their own callback so overlay tweaks stay isolated from sampling/logging.
 * The detector hands us normalized points; we scale them to each canvas and render the focus marker.
 */
detector.onPointsDetected((points) => {
  for (const point of points) {
    const videoPixelX = point.x * videoOverlayCanvas.width;
    const videoPixelY = point.y * videoOverlayCanvas.height;
    drawFingerFocus(videoOverlayCtx, { x: videoPixelX, y: videoPixelY });

    const imagePixelX = point.x * imageOverlayCanvas.width;
    const imagePixelY = point.y * imageOverlayCanvas.height;
    drawFingerFocus(imageOverlayCtx, { x: imagePixelX, y: imagePixelY });
  }
});

/*
 * We log tone samples separately so debug output can evolve without affecting rendering.
 * When the sampler is ready, we translate fingertip hue/value bytes into frequency and volume for the panel.
 */
detector.onPointsDetected((points) => {
  const debugToneSamples: DebugToneSample[] = [];

  for (const point of points) {
    if (!samplerReady) {
      continue;
    }

    const sample = sampler.sampleAt(point);
    if (sample) {
      const hueByte = sample.data.hueByte ?? 0;
      const valueByte = sample.data.valueByte ?? 0;
      const frequency = minFreq + (hueByte / 255) * (maxFreq - minFreq);
      const volume = minVol + (valueByte / 255) * (maxVol - minVol);
      debugToneSamples.push({
        toneId: point.id,
        frequency,
        volume,
        hueByte,
        saturationByte: sample.data.saturationByte ?? 0,
        valueByte,
      });
    }
  }

  debugTools.logToneSamples(debugToneSamples);
});

// --- Controls ---------------------------------------------------------------

const syncControlLabels = () => {
  minFreqValue.textContent = String(minFreq);
  maxFreqValue.textContent = String(maxFreq);
  minVolValue.textContent = String(minVolSlider.value);
  maxVolValue.textContent = String(maxVolSlider.value);
  maxHandsValue.textContent = String(maxHands);
};
syncControlLabels();

const setMirrorState = (nextState: boolean) => {
  isMirrored = nextState;
  document.body.classList.toggle("is-mirrored", isMirrored);
  mirrorToggleButton.textContent = isMirrored ? "Disable mirror mode" : "Enable mirror mode";
  detector.setMirror(isMirrored);
};
setMirrorState(isMirrored);

minFreqSlider.addEventListener("input", (event) => {
  minFreq = Number((event.target as HTMLInputElement).value);
  minFreqValue.textContent = String(minFreq);
  sonifier.configure({ minFreq });
});

maxFreqSlider.addEventListener("input", (event) => {
  maxFreq = Number((event.target as HTMLInputElement).value);
  maxFreqValue.textContent = String(maxFreq);
  sonifier.configure({ maxFreq });
});

minVolSlider.addEventListener("input", (event) => {
  minVol = Number((event.target as HTMLInputElement).value) / 100;
  minVolValue.textContent = String(minVolSlider.value);
  sonifier.configure({ minVol });
});

maxVolSlider.addEventListener("input", (event) => {
  maxVol = Number((event.target as HTMLInputElement).value) / 100;
  maxVolValue.textContent = String(maxVolSlider.value);
  sonifier.configure({ maxVol });
});

mirrorToggleButton.addEventListener("click", () => {
  setMirrorState(!isMirrored);
});

maxHandsSlider.addEventListener("input", (event) => {
  maxHands = Math.max(1, Math.min(8, Number((event.target as HTMLInputElement).value)));
  maxHandsValue.textContent = String(maxHands);
  detector.setMaxHands(maxHands);
});

oscillatorTypeSelect.addEventListener("change", (event) => {
  const nextType = (event.target as HTMLSelectElement).value as OscillatorType;
  sonifier.configure({ oscillatorType: nextType });
});

cameraFacingSelect.addEventListener("change", (event) => {
  const nextFacing = ((event.target as HTMLSelectElement).value as FacingMode) || "user";
  void detector.restartCamera(nextFacing);
});

// --- Startup ----------------------------------------------------------------

const startPipeline = async () => {
  statusLabel.textContent = "Initializing hands detection...";
  try {
    await controller.start();
    statusLabel.textContent = "Running - move your hands to hear sonification";
  } catch (error) {
    console.error("Failed to start detection/audio:", error);
    statusLabel.textContent = `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
};

resizeCanvases();
window.addEventListener("resize", resizeCanvases);
void startPipeline();
