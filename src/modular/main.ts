/**
 * Modular Herakoi Implementation
 *
 * We keep this entrypoint focused on wiring: load the image once, size the
 * canvases, and hand control to ApplicationController so the detect → sample
 * → sonify loop stays swappable. UI controls mirror the one-channel demo while
 * letting us swap detector/sampler/sonifier implementations later.
 */

import { ApplicationController } from "#src/core/ApplicationController";
import { getMediaPipeDetector } from "#src/detection/mediapipe/factory";
import { DetectorControls } from "#src/detection/mediapipe/uiControls";
import { bindHandsUi } from "#src/detection/mediapipe/uiHands";
import { buildDebugToneLogger } from "#src/modular/debugConfig";
import { HSVSamplerControls } from "#src/sampling/hsv/uiControls";
import { getOscillatorSonifier } from "#src/sonification/oscillator/factory";
import { OscillatorControls } from "#src/sonification/oscillator/uiControls";
import { requireElement } from "#src/utils/dom";
import "./style.css";

import zodiacConstellationsUrl from "../assets/zodiac-constellations.jpg?url";

// --- DOM lookups ------------------------------------------------------------

const statusLabel = requireElement<HTMLSpanElement>("modular-status");

// --- UI control modules -----------------------------------------------------

// Module-scoped control groups keep UI wiring beside their respective modules.
const detectorControls = new DetectorControls();
const oscillatorControls = new OscillatorControls();
const hsvControls = new HSVSamplerControls(
  zodiacConstellationsUrl,
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
const controller = new ApplicationController(detector, sampler, sonifier);

// --- UI hands drawing ----------------------------------------------------

const { imageOverlayCanvas } = hsvControls.elements;
const { videoOverlayCanvas } = detectorControls.elements;
bindHandsUi(detector, [videoOverlayCanvas, imageOverlayCanvas]);

// --- Debug logging ----------------------------------------------------------

const logDebugTones = buildDebugToneLogger(
  sampler,
  oscillatorState,
  () => hsvControls.state.samplerReady,
);
detector.onPointsDetected(logDebugTones);

// --- Pipeline startup -------------------------------------------------------

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

// -- canvas resizes
window.addEventListener("resize", () => {
  hsvControls.resizeCanvases();
  detectorControls.resizeOverlayCanvas();
});

// -- START

void startPipeline();

hsvControls.resizeCanvases();
detectorControls.resizeOverlayCanvas();
