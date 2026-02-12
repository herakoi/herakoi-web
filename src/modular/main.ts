/**
 * Modular Herakoi Implementation
 *
 * We keep this entrypoint focused on wiring: load the image once, size the
 * canvases, and hand control to ApplicationController so the detect → sample
 * → sonify loop stays swappable. UI controls mirror the one-channel demo while
 * letting us swap detector/sampler/sonifier implementations later.
 */

import type { ImageSample } from "#src/core/interfaces";
import { getMediaPipeDetector } from "#src/detection/mediapipe/factory";
import { DetectorControls } from "#src/detection/mediapipe/uiControls";
import { bindHandsUi } from "#src/detection/mediapipe/uiHands";
import { attachDevFrequencyLabels, buildDebugToneLogger } from "#src/modular/debugConfig";
import { getDefaultCuratedImage } from "#src/sampling/hsv/data/curatedImages";
import { HSVSamplerControls } from "#src/sampling/hsv/uiControls";
import { getOscillatorSonifier } from "#src/sonification/oscillator/factory";
import { OscillatorControls } from "#src/sonification/oscillator/uiControls";
import { requireElement } from "#src/utils/dom";
import "./style.css";

// --- DOM lookups ------------------------------------------------------------

const statusLabel = requireElement<HTMLSpanElement>("modular-status");

// --- UI control modules -----------------------------------------------------

// Module-scoped control groups keep UI wiring beside their respective modules.
const detectorControls = new DetectorControls();
const oscillatorControls = new OscillatorControls();
const curatedDefault = getDefaultCuratedImage();

if (!curatedDefault) {
  throw new Error("No curated images found in src/app/assets/curated.");
}

const hsvControls = new HSVSamplerControls(
  curatedDefault.src,
  () => {
    statusLabel.textContent = "Image loaded and ready for sampling";
  },
  (message) => {
    statusLabel.textContent = message;
  },
);

// --- Core ------------------------------------------------------------------

const { state: oscillatorState } = oscillatorControls;
const sampler = hsvControls.sampler;

const sonifier = getOscillatorSonifier(oscillatorControls);
const detector = getMediaPipeDetector(detectorControls);

// --- UI hands drawing ----------------------------------------------------

const { imageOverlayCanvas } = hsvControls.elements;
const { videoOverlayCanvas } = detectorControls.elements;
const imageOverlayCtx = imageOverlayCanvas.getContext("2d") as CanvasRenderingContext2D;
bindHandsUi(detector, [videoOverlayCanvas, imageOverlayCanvas]);

// --- Debug logging ----------------------------------------------------------

const logDebugTones = buildDebugToneLogger(
  sampler,
  oscillatorState,
  () => hsvControls.state.samplerReady,
);
detector.onPointsDetected(logDebugTones);
attachDevFrequencyLabels(
  detector,
  sampler,
  oscillatorState,
  { canvas: imageOverlayCanvas, ctx: imageOverlayCtx },
  () => hsvControls.state.samplerReady,
);

// --- Pipeline startup -------------------------------------------------------

const startPipeline = async () => {
  statusLabel.textContent = "Initializing hands detection...";
  try {
    // Initialize detector and sonifier (inlined from ApplicationController)
    await detector.initialize();
    await sonifier.initialize();

    // Register detection callback that orchestrates the sonification loop
    detector.onPointsDetected((points) => {
      const samples = new Map<string, ImageSample>();

      for (const point of points) {
        const sample = sampler.sampleAt(point);
        if (sample) {
          samples.set(point.id, sample);
        }
      }

      sonifier.processSamples(samples);
    });

    // Start detection
    detector.start();

    statusLabel.textContent = "Running - move your hands to hear sonification";
  } catch (error) {
    console.error("Failed to start detection/audio:", error);
    statusLabel.textContent = `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
};

// -- canvas resizes
window.addEventListener("resize", () => {
  hsvControls.resizeCanvases();
  detectorControls.resizeOverlayCanvas();
});

// -- START

void startPipeline();

hsvControls.resizeCanvases();
detectorControls.resizeOverlayCanvas();
