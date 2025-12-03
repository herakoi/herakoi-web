/**
 * TEMPORARY: ApplicationController is being rewritten from scratch.
 * This entry point is currently disabled. Once the new controller is ready,
 * this file will be updated to use it.
 *
 * TODO: Rebuild ApplicationController with proper lifecycle management
 */

import "./../style.css";

// import { ApplicationController } from "#src/core/ApplicationController";
// import { MediaPipePointDetector } from "#src/detection/mediapipe/MediaPipePointDetector";
// import { HSVImageSampler } from "#src/sampling/HSVImageSampler";
// import { OscillatorSonifier } from "#src/sonification/OscillatorSonifier";

import zodiacConstellationsUrl from "../assets/zodiac-constellations.jpg?url";

const startButton = document.getElementById("start-modular") as HTMLButtonElement | null;
const statusLabel = document.getElementById("modular-status") as HTMLSpanElement | null;
const videoElement = document.getElementById("modular-video") as HTMLVideoElement | null;
const imageCanvas = document.getElementById("modular-image") as HTMLCanvasElement | null;

if (!startButton || !statusLabel || !videoElement || !imageCanvas) {
  throw new Error("Modular page markup is missing required elements.");
}

// Temporarily disabled - ApplicationController being rewritten
// const sampler = new HSVImageSampler();
// let samplerReady = false;
// const sonifier = new OscillatorSonifier(undefined, {
//   minFreq: 200,
//   maxFreq: 700,
//   minVol: 0,
//   maxVol: 0.2,
//   oscillatorType: "sine",
//   fadeMs: 120,
// });

// const detector = new MediaPipePointDetector(videoElement, { maxHands: 2 });
// const controller = new ApplicationController(detector, sampler, sonifier);

const defaultImage = new Image();
defaultImage.crossOrigin = "anonymous";
defaultImage.src = zodiacConstellationsUrl;

// const drawImageToCanvas = (img: HTMLImageElement) => {
//   const ctx = imageCanvas.getContext("2d");
//   if (!ctx) {
//     throw new Error("Could not get 2D context for modular image canvas.");
//   }

//   imageCanvas.width = img.naturalWidth || 640;
//   imageCanvas.height = img.naturalHeight || 480;
//   ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
//   ctx.drawImage(img, 0, 0, imageCanvas.width, imageCanvas.height);
// };

// const loadSamplerFromImage = async (img: HTMLImageElement) => {
//   drawImageToCanvas(img);
//   await sampler.loadImage(imageCanvas);
//   samplerReady = true;
// };

defaultImage.onload = async () => {
  // await loadSamplerFromImage(defaultImage);
  statusLabel.textContent = "ApplicationController temporarily disabled - being rewritten";
};

defaultImage.onerror = () => {
  statusLabel.textContent = "Failed to load default image";
};

// const startApp = async () => {
//   statusLabel.textContent = "Starting...";
//   try {
//     if (!samplerReady) {
//       statusLabel.textContent = "Sampler image not ready yet";
//       return;
//     }
//     await controller.start();
//     statusLabel.textContent = "Running (modular controller)";
//   } catch (error) {
//     console.error("Failed to start modular controller", error);
//     statusLabel.textContent = "Failed to start";
//   }
// };

startButton.addEventListener("click", () => {
  // void startApp();
  statusLabel.textContent = "ApplicationController temporarily disabled - being rewritten";
});

// const imageInput = document.getElementById("modular-image-upload") as HTMLInputElement | null;

// imageInput?.addEventListener("change", (event) => {
//   const file = (event.target as HTMLInputElement).files?.[0];
//   if (!file) return;

//   const url = URL.createObjectURL(file);
//   const img = new Image();
//   img.onload = async () => {
//     await loadSamplerFromImage(img);
//     statusLabel.textContent = "Custom image loaded";
//     URL.revokeObjectURL(url);
//   };
//   img.onerror = () => {
//     statusLabel.textContent = "Failed to load custom image";
//     URL.revokeObjectURL(url);
//   };
//   img.src = url;
// });
