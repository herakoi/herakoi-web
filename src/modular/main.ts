/**
 * Modular Herakoi Implementation
 *
 * Rebuilding oneChannel/main.ts using the new interface-driven architecture.
 * This implementation uses MediaPipePointDetector, HSVImageSampler, and OscillatorSonifier
 * to maintain the same functionality with pluggable components.
 */

import "./style.css";

import { drawFingerFocus, drawHands } from "#src/canvas/overlay";
import { type DebugToneSample, setupDebugTools } from "#src/debug/index";
import {
  type FacingMode,
  MediaPipePointDetector,
} from "#src/detection/mediapipe/MediaPipePointDetector";
import { HSVImageSampler } from "#src/sampling/HSVImageSampler";
import { OscillatorSonifier } from "#src/sonification/OscillatorSonifier";

import zodiacConstellationsUrl from "../assets/zodiac-constellations.jpg?url";

const statusLabel = document.getElementById("modular-status");
const videoElement = document.getElementById("modular-video") as HTMLVideoElement | null;
const videoOverlayCanvas = document.getElementById(
  "modular-video-overlay",
) as HTMLCanvasElement | null;
const imageCanvas = document.getElementById("modular-image") as HTMLCanvasElement | null;
const imageOverlayCanvas = document.getElementById(
  "modular-image-overlay",
) as HTMLCanvasElement | null;

if (!statusLabel || !videoElement || !videoOverlayCanvas || !imageCanvas || !imageOverlayCanvas) {
  throw new Error("Modular page markup is missing required elements.");
}

const videoOverlayCtx = videoOverlayCanvas.getContext("2d");
const imageOverlayCtx = imageOverlayCanvas.getContext("2d");
if (!videoOverlayCtx || !imageOverlayCtx) {
  throw new Error("Unable to acquire 2D contexts for overlay canvases.");
}

// Get control elements
const minFreqSlider = document.getElementById("modular-min-freq") as HTMLInputElement | null;
const maxFreqSlider = document.getElementById("modular-max-freq") as HTMLInputElement | null;
const minFreqValue = document.getElementById("modular-min-freq-value");
const maxFreqValue = document.getElementById("modular-max-freq-value");

const minVolSlider = document.getElementById("modular-min-vol") as HTMLInputElement | null;
const maxVolSlider = document.getElementById("modular-max-vol") as HTMLInputElement | null;
const minVolValue = document.getElementById("modular-min-vol-value");
const maxVolValue = document.getElementById("modular-max-vol-value");

const mirrorToggleButton = document.getElementById(
  "modular-mirror-toggle",
) as HTMLButtonElement | null;
const maxHandsSlider = document.getElementById("modular-max-hands") as HTMLInputElement | null;
const maxHandsValue = document.getElementById("modular-max-hands-value");
const oscillatorTypeSelect = document.getElementById(
  "modular-oscillator-type",
) as HTMLSelectElement | null;
const cameraFacingSelect = document.getElementById(
  "modular-camera-facing",
) as HTMLSelectElement | null;

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
  throw new Error("Expected control elements to be present.");
}

// Mirror state (matches body class)
let isMirrored = document.body.classList.contains("is-mirrored");

// Initialize control values
let minFreq = Number(minFreqSlider.value) || 200;
let maxFreq = Number(maxFreqSlider.value) || 700;
let minVol = Number(minVolSlider.value) || 0;
let maxVol = Number(maxVolSlider.value) / 100 || 0.2; // Convert 0-100 range to 0-1
let maxHands = Number(maxHandsSlider.value) || 2;
const initialOscType = (oscillatorTypeSelect.value || "sine") as OscillatorType;
const initialFacingMode: FacingMode = (cameraFacingSelect.value as FacingMode) || "user";

// Update value displays
minFreqValue.textContent = String(minFreq);
maxFreqValue.textContent = String(maxFreq);
minVolValue.textContent = String(minVolSlider.value);
maxVolValue.textContent = String(maxVolSlider.value);
maxHandsValue.textContent = String(maxHands);

// Step 1: Set up hands detection
// MediaPipePointDetector wraps both HandsDetector and Camera, matching oneChannel/main.ts behavior
const detector = new MediaPipePointDetector(videoElement, {
  maxHands,
  mirrorX: isMirrored, // Apply mirroring at detector level
  facingMode: initialFacingMode,
  mediaPipeOptions: {
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  },
});

// Step 1a: Register hand visualization drawer
// This MediaPipe-specific callback draws the hand skeleton on both overlays
// Note: landmarks are already mirrored by the detector if mirrorX is enabled
detector.onHandsDrawn((landmarks) => {
  // Clear previous frame on both overlays
  videoOverlayCtx.clearRect(0, 0, videoOverlayCanvas.width, videoOverlayCanvas.height);
  imageOverlayCtx.clearRect(0, 0, imageOverlayCanvas.width, imageOverlayCanvas.height);

  // Draw each detected hand on both video and image canvases
  for (const handLandmarks of landmarks) {
    drawHands([
      { ctx: videoOverlayCtx, landmarks: handLandmarks },
      { ctx: imageOverlayCtx, landmarks: handLandmarks },
    ]);
  }
});

// Step 1b: Draw finger focus squares on detected fingertips and sample image
// Note: points are already mirrored by the detector if mirrorX is enabled
detector.onPointsDetected((points) => {
  // Convert normalized coordinates to pixel coordinates and draw squares on both canvases
  for (const point of points) {
    // Draw on video overlay
    const videoPixelX = point.x * videoOverlayCanvas.width;
    const videoPixelY = point.y * videoOverlayCanvas.height;
    drawFingerFocus(videoOverlayCtx, { x: videoPixelX, y: videoPixelY });

    // Draw on image overlay
    const imagePixelX = point.x * imageOverlayCanvas.width;
    const imagePixelY = point.y * imageOverlayCanvas.height;
    drawFingerFocus(imageOverlayCtx, { x: imagePixelX, y: imagePixelY });
  }

  // Sample image at detected points and send to sonifier
  // IMPORTANT: Always call processSamples (even with empty map) so sonifier
  // knows to stop tones when hands disappear
  const samples = new Map();
  const debugToneSamples: DebugToneSample[] = [];

  if (samplerReady) {
    for (const point of points) {
      const sample = sampler.sampleAt(point);
      if (sample) {
        samples.set(point.id, sample);

        // Build debug data by calculating frequency/volume from sample
        const hueByte = sample.data.hueByte ?? 0;
        const saturationByte = sample.data.saturationByte ?? 0;
        const valueByte = sample.data.valueByte ?? 0;
        const frequency = minFreq + (hueByte / 255) * (maxFreq - minFreq);
        const volume = minVol + (valueByte / 255) * (maxVol - minVol);

        debugToneSamples.push({
          toneId: point.id,
          frequency,
          volume,
          hueByte,
          saturationByte,
          valueByte,
        });
      }
    }
  }

  // Send samples to sonifier (empty map = stop all tones)
  sonifier.processSamples(samples);

  // Update debug HUD
  debugTools.logToneSamples(debugToneSamples);
});

// Step 2: Auto-start detection on page load (matching oneChannel behavior)
const startDetection = async () => {
  if (statusLabel) {
    statusLabel.textContent = "Initializing hands detection...";
  }

  try {
    await detector.initialize();
    if (statusLabel) {
      statusLabel.textContent = "Initializing audio...";
    }

    await sonifier.initialize();
    if (statusLabel) {
      statusLabel.textContent = "Starting camera...";
    }

    detector.start();

    if (statusLabel) {
      statusLabel.textContent = "Running - move your hands to hear sonification";
    }
  } catch (error) {
    console.error("Failed to start detection/audio:", error);
    if (statusLabel) {
      statusLabel.textContent = `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }
};

// Auto-start on page load
void startDetection();

// Step 4: Setup image sampling
const sampler = new HSVImageSampler();
let samplerReady = false;

// Step 5: Setup audio sonification
const sonifier = new OscillatorSonifier(undefined, {
  minFreq,
  maxFreq,
  minVol,
  maxVol,
  oscillatorType: initialOscType,
  fadeMs: 120,
});

// Step 6: Setup debug tools
const debugTools = setupDebugTools();

const imageCtx = imageCanvas.getContext("2d");
if (!imageCtx) {
  throw new Error("Unable to acquire 2D context for image canvas.");
}

// Helper to draw image to canvas and load into sampler
const drawImageToCanvas = (img: HTMLImageElement) => {
  imageCanvas.width = img.naturalWidth || 640;
  imageCanvas.height = img.naturalHeight || 480;
  imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
  imageCtx.drawImage(img, 0, 0, imageCanvas.width, imageCanvas.height);
};

const loadSamplerFromImage = async (img: HTMLImageElement) => {
  drawImageToCanvas(img);
  await sampler.loadImage(imageCanvas);
  samplerReady = true;
  if (statusLabel) {
    statusLabel.textContent = "Image loaded and ready for sampling";
  }
};

// Load default zodiac constellation image
const defaultImage = new Image();
defaultImage.crossOrigin = "anonymous";
defaultImage.src = zodiacConstellationsUrl;

defaultImage.onload = async () => {
  await loadSamplerFromImage(defaultImage);
};

defaultImage.onerror = () => {
  if (statusLabel) {
    statusLabel.textContent = "Failed to load default image";
  }
};

// Handle image upload
const imageInput = document.getElementById("modular-image-upload") as HTMLInputElement | null;

imageInput?.addEventListener("change", (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = async () => {
    await loadSamplerFromImage(img);
    URL.revokeObjectURL(url);
  };
  img.onerror = () => {
    if (statusLabel) {
      statusLabel.textContent = "Failed to load custom image";
    }
    URL.revokeObjectURL(url);
  };
  img.src = url;
});

// Step 3: Setup canvas sizing (matching oneChannel behavior)
const FALLBACK_CANVAS_WIDTH = 640;
const PANEL_ASPECT_RATIO = 4 / 3;
const FALLBACK_CANVAS_HEIGHT = Math.round(FALLBACK_CANVAS_WIDTH / PANEL_ASPECT_RATIO);

const measureCanvasSize = (canvas: HTMLCanvasElement): { width: number; height: number } => {
  const parentRect = canvas.parentElement?.getBoundingClientRect();
  const rect = parentRect && parentRect.width > 0 ? parentRect : canvas.getBoundingClientRect();
  const measuredWidth = Math.round(rect.width);
  const measuredHeight = Math.round(rect.height);

  const width = measuredWidth || FALLBACK_CANVAS_WIDTH;
  const height = measuredHeight || Math.round(width / PANEL_ASPECT_RATIO) || FALLBACK_CANVAS_HEIGHT;
  return { width, height };
};

function setupCanvasSizes() {
  const canvases = [videoOverlayCanvas, imageCanvas, imageOverlayCanvas].filter(
    (canvas): canvas is HTMLCanvasElement => canvas instanceof HTMLCanvasElement,
  );

  for (const canvas of canvases) {
    const { width, height } = measureCanvasSize(canvas);
    canvas.width = width;
    canvas.height = height;
  }

  // Resizing clears canvas pixels, so redraw the source image if loaded
  if (samplerReady && defaultImage.complete) {
    drawImageToCanvas(defaultImage);
  }
}

setupCanvasSizes();
window.addEventListener("resize", setupCanvasSizes);

// Step 7: Setup control event listeners

// Frequency sliders
minFreqSlider.addEventListener("input", (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  minFreq = value;
  minFreqValue.textContent = String(value);
  sonifier.configure({ minFreq });
});

maxFreqSlider.addEventListener("input", (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  maxFreq = value;
  maxFreqValue.textContent = String(value);
  sonifier.configure({ maxFreq });
});

// Volume sliders
minVolSlider.addEventListener("input", (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  minVol = value / 100; // Convert 0-100 to 0-1
  minVolValue.textContent = String(value);
  sonifier.configure({ minVol });
});

maxVolSlider.addEventListener("input", (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  maxVol = value / 100; // Convert 0-100 to 0-1
  maxVolValue.textContent = String(value);
  sonifier.configure({ maxVol });
});

// Mirror toggle
const setMirrorState = (nextState: boolean) => {
  isMirrored = nextState;
  document.body.classList.toggle("is-mirrored", isMirrored);
  mirrorToggleButton.textContent = isMirrored ? "Disable mirror mode" : "Enable mirror mode";

  // Keep detector coordinates aligned with the displayed video so overlays track correctly
  detector.setMirror(isMirrored);
};

mirrorToggleButton.addEventListener("click", () => {
  setMirrorState(!isMirrored);
});

// Initialize mirror button text
setMirrorState(isMirrored);

// Max hands slider - Note: MediaPipe requires recreation to change maxHands
maxHandsSlider.addEventListener("input", (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  maxHands = Math.max(1, Math.min(8, value));
  maxHandsValue.textContent = String(maxHands);
  detector.setMaxHands(maxHands);
});

// Oscillator type selector
oscillatorTypeSelect.addEventListener("change", (event) => {
  const nextType = (event.target as HTMLSelectElement).value as OscillatorType;
  sonifier.configure({ oscillatorType: nextType });
});

// Camera facing selector - restart camera with new facing mode
cameraFacingSelect.addEventListener("change", (event) => {
  const nextFacing = ((event.target as HTMLSelectElement).value as FacingMode) || "user";
  void detector.restartCamera(nextFacing);
});
