/**
 * MediaPipe detector UI controls keep camera and hand settings near the detector itself.
 *
 * Why: Coupling the DOM controls to this module makes it obvious how UI changes restart or
 * tweak the underlying MediaPipe configuration.
 * What: We expose the elements, default state, and listener binding so entrypoints can wire
 * the detector once and keep the control logic contained here.
 * How: Call createDetectorControls with a requireElement helper, pass its defaults into the
 * MediaPipePointDetector constructor, then bind listeners with the detector instance.
 */

import { requireElement } from "#src/utils/dom";
import type { FacingMode, MediaPipePointDetector } from "./MediaPipePointDetector";

export type DetectorControlState = {
  isMirrored: boolean;
  maxHands: number;
  facingMode: FacingMode;
};

/**
 * DetectorControls centralizes MediaPipe-related DOM controls and behaviors.
 */
export class DetectorControls {
  public readonly elements: {
    videoElement: HTMLVideoElement;
    videoOverlayCanvas: HTMLCanvasElement;
    mirrorToggleButton: HTMLButtonElement;
    maxHandsSlider: HTMLInputElement;
    maxHandsValue: HTMLSpanElement;
    cameraFacingSelect: HTMLSelectElement;
  };

  public readonly state: DetectorControlState;

  private readonly FALLBACK_CANVAS_WIDTH = 640;
  private readonly PANEL_ASPECT_RATIO = 4 / 3;
  private readonly FALLBACK_CANVAS_HEIGHT = Math.round(
    this.FALLBACK_CANVAS_WIDTH / this.PANEL_ASPECT_RATIO,
  );

  constructor() {
    const videoElement = requireElement<HTMLVideoElement>("modular-video");
    const videoOverlayCanvas = requireElement<HTMLCanvasElement>("modular-video-overlay");
    const mirrorToggleButton = requireElement<HTMLButtonElement>("modular-mirror-toggle");
    const maxHandsSlider = requireElement<HTMLInputElement>("modular-max-hands");
    const maxHandsValue = requireElement<HTMLSpanElement>("modular-max-hands-value");
    const cameraFacingSelect = requireElement<HTMLSelectElement>("modular-camera-facing");

    this.elements = {
      videoElement,
      videoOverlayCanvas,
      mirrorToggleButton,
      maxHandsSlider,
      maxHandsValue,
      cameraFacingSelect,
    };

    this.state = {
      isMirrored: document.body.classList.contains("is-mirrored"),
      maxHands: Number(maxHandsSlider.value) || 2,
      facingMode: (cameraFacingSelect.value as FacingMode) || "user",
    };

    this.resizeOverlayCanvas();
    window.addEventListener("resize", () => this.resizeOverlayCanvas());
  }

  public attach(detector: MediaPipePointDetector): void {
    this.syncLabels();
    this.bindListeners(detector);
  }

  private syncLabels(): void {
    this.elements.maxHandsValue.textContent = String(this.state.maxHands);
  }

  public resizeOverlayCanvas(): void {
    const { videoOverlayCanvas } = this.elements;
    const { width, height } = this.measureCanvasSize(videoOverlayCanvas);
    videoOverlayCanvas.width = width;
    videoOverlayCanvas.height = height;
  }

  private bindListeners(detector: MediaPipePointDetector): void {
    const { mirrorToggleButton, maxHandsSlider, maxHandsValue, cameraFacingSelect } = this.elements;

    const setMirrorState = (nextState: boolean) => {
      this.state.isMirrored = nextState;
      document.body.classList.toggle("is-mirrored", this.state.isMirrored);
      mirrorToggleButton.textContent = this.state.isMirrored
        ? "Disable mirror mode"
        : "Enable mirror mode";
      detector.setMirror(this.state.isMirrored);
    };

    setMirrorState(this.state.isMirrored);

    mirrorToggleButton.addEventListener("click", () => {
      setMirrorState(!this.state.isMirrored);
    });

    maxHandsSlider.addEventListener("input", (event) => {
      this.state.maxHands = Math.max(
        1,
        Math.min(8, Number((event.target as HTMLInputElement).value)),
      );
      maxHandsValue.textContent = String(this.state.maxHands);
      detector.setMaxHands(this.state.maxHands);
    });

    cameraFacingSelect.addEventListener("change", (event) => {
      const nextFacing = ((event.target as HTMLSelectElement).value as FacingMode) || "user";
      this.state.facingMode = nextFacing;
      void detector.restartCamera(nextFacing);
    });
  }

  private measureCanvasSize(canvas: HTMLCanvasElement): { width: number; height: number } {
    const parentRect = canvas.parentElement?.getBoundingClientRect();
    const rect = parentRect && parentRect.width > 0 ? parentRect : canvas.getBoundingClientRect();
    const width = Math.round(rect.width) || this.FALLBACK_CANVAS_WIDTH;
    const height =
      Math.round(rect.height) ||
      Math.round(width / this.PANEL_ASPECT_RATIO) ||
      this.FALLBACK_CANVAS_HEIGHT;
    return { width, height };
  }
}
