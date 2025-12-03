/**
 * Modular Herakoi Implementation
 *
 * Rebuilding oneChannel/main.ts using the new interface-driven architecture.
 * This implementation uses MediaPipePointDetector, HSVImageSampler, and OscillatorSonifier
 * to maintain the same functionality with pluggable components.
 */

import "./style.css";

import type { NormalizedLandmarkList } from "@mediapipe/hands";
import { drawFingerFocus, drawHands } from "#src/canvas/overlay";
import { MediaPipePointDetector } from "#src/detection/mediapipe/MediaPipePointDetector";
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

// Mirror state (matches body class)
const isMirrored = document.body.classList.contains("is-mirrored");

// Helper function to mirror landmarks horizontally
function mirrorLandmarks(landmarks: NormalizedLandmarkList): NormalizedLandmarkList {
  return landmarks.map((landmark) => ({
    ...landmark,
    x: 1 - landmark.x,
  })) as NormalizedLandmarkList;
}

// Step 1: Set up hands detection
// MediaPipePointDetector wraps both HandsDetector and Camera, matching oneChannel/main.ts behavior
const detector = new MediaPipePointDetector(videoElement, {
  maxHands: 2,
  mediaPipeOptions: {
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  },
});

// Step 1a: Register hand visualization drawer
// This MediaPipe-specific callback draws the hand skeleton on both overlays
detector.onHandsDrawn((landmarks) => {
  // Clear previous frame on both overlays
  videoOverlayCtx.clearRect(0, 0, videoOverlayCanvas.width, videoOverlayCanvas.height);
  imageOverlayCtx.clearRect(0, 0, imageOverlayCanvas.width, imageOverlayCanvas.height);

  // Draw each detected hand on both video and image canvases
  for (const handLandmarks of landmarks) {
    const workingLandmarks = isMirrored ? mirrorLandmarks(handLandmarks) : handLandmarks;
    drawHands([
      { ctx: videoOverlayCtx, landmarks: workingLandmarks },
      { ctx: imageOverlayCtx, landmarks: workingLandmarks },
    ]);
  }
});

// Step 1b: Draw finger focus squares on detected fingertips and sample image
detector.onPointsDetected((points) => {
  // Convert normalized coordinates to pixel coordinates and draw squares on both canvases
  for (const point of points) {
    // Mirror x-coordinate if needed for visualization
    const normalizedX = isMirrored ? 1 - point.x : point.x;

    // Draw on video overlay
    const videoPixelX = normalizedX * videoOverlayCanvas.width;
    const videoPixelY = point.y * videoOverlayCanvas.height;
    drawFingerFocus(videoOverlayCtx, { x: videoPixelX, y: videoPixelY });

    // Draw on image overlay
    const imagePixelX = normalizedX * imageOverlayCanvas.width;
    const imagePixelY = point.y * imageOverlayCanvas.height;
    drawFingerFocus(imageOverlayCtx, { x: imagePixelX, y: imagePixelY });
  }

  // Sample image at detected points and send to sonifier
  // IMPORTANT: Always call processSamples (even with empty map) so sonifier
  // knows to stop tones when hands disappear
  const samples = new Map();

  if (samplerReady) {
    for (const point of points) {
      const sample = sampler.sampleAt(point);
      if (sample) {
        samples.set(point.id, sample);
      }
    }
  }

  // Send samples to sonifier (empty map = stop all tones)
  sonifier.processSamples(samples);
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
  minFreq: 200,
  maxFreq: 700,
  minVol: 0,
  maxVol: 0.2,
  oscillatorType: "sine",
  fadeMs: 120,
});

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
