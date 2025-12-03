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
// import { HSVImageSampler } from "#src/sampling/HSVImageSampler";
// import { OscillatorSonifier } from "#src/sonification/OscillatorSonifier";

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
// This MediaPipe-specific callback draws the hand skeleton on the video overlay
detector.onHandsDrawn((landmarks) => {
  // Clear previous frame
  videoOverlayCtx.clearRect(0, 0, videoOverlayCanvas.width, videoOverlayCanvas.height);

  // Draw each detected hand (mirror if needed)
  for (const handLandmarks of landmarks) {
    const workingLandmarks = isMirrored ? mirrorLandmarks(handLandmarks) : handLandmarks;
    drawHands([{ ctx: videoOverlayCtx, landmarks: workingLandmarks }]);
  }
});

// Step 1b: Draw finger focus squares on detected fingertips
detector.onPointsDetected((points) => {
  // Convert normalized coordinates to pixel coordinates and draw squares
  for (const point of points) {
    // Mirror x-coordinate if needed
    const normalizedX = isMirrored ? 1 - point.x : point.x;
    const pixelX = normalizedX * videoOverlayCanvas.width;
    const pixelY = point.y * videoOverlayCanvas.height;
    drawFingerFocus(videoOverlayCtx, { x: pixelX, y: pixelY });
  }

  if (points.length > 0) {
    console.log(`Detected ${points.length} points:`, points);
  }
});

// Step 2: Auto-start detection on page load (matching oneChannel behavior)
const startDetection = async () => {
  if (statusLabel) {
    statusLabel.textContent = "Initializing hands detection...";
  }

  try {
    await detector.initialize();
    if (statusLabel) {
      statusLabel.textContent = "Starting camera...";
    }

    detector.start();

    if (statusLabel) {
      statusLabel.textContent = "Running - move your hands in front of the camera";
    }
  } catch (error) {
    console.error("Failed to start hands detection:", error);
    if (statusLabel) {
      statusLabel.textContent = `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }
};

// Auto-start on page load
void startDetection();

// For now, just show a placeholder message for the image
const defaultImage = new Image();
defaultImage.crossOrigin = "anonymous";
defaultImage.src = zodiacConstellationsUrl;

defaultImage.onload = () => {
  // Image loaded, will be used later for sampling
};

defaultImage.onerror = () => {
  if (statusLabel) {
    statusLabel.textContent = "Failed to load default image";
  }
};

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

  // TODO: When image sampling is added, redraw the source image here
}

setupCanvasSizes();
window.addEventListener("resize", setupCanvasSizes);
