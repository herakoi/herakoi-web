/**
 * HSV sampler UI controls sit next to the sampler so image loading flows stay encapsulated.
 *
 * Why: The sampler depends on specific canvases and upload inputs; keeping those bindings
 * here avoids scattering canvas sizing and load status across entrypoints.
 * What: We expose the relevant elements, a ready flag, and helpers to draw/load images and
 * wire the upload input.
 * How: Create controls with the entrypoint's requireElement helper, then call the returned
 * helpers to draw default images and handle uploads. The samplerReady flag updates once an
 * image is encoded.
 */

import { requireElement } from "#src/utils/dom";
import { HSVImageSampler } from "./HSVImageSampler";

export type HSVSamplerState = {
  samplerReady: boolean;
};

/**
 * HSVSamplerControls keeps image canvases, upload wiring, and sampler readiness together.
 *
 * Why: The sampler depends on specific DOM surfaces; centralizing them in a class makes
 * navigation easier and keeps resize/load logic cohesive.
 * What: Exposes elements, sampler instance, state, and helper methods to draw, load,
 * attach uploads, and resize canvases.
 * How: Instantiate once per entrypoint, then call the public methods as needed.
 */
export class HSVSamplerControls {
  public readonly elements: {
    imageCanvas: HTMLCanvasElement;
    imageOverlayCanvas: HTMLCanvasElement;
    imageInput: HTMLInputElement;
  };

  public readonly sampler: HSVImageSampler;
  public readonly state: HSVSamplerState = { samplerReady: false };
  private lastImage: HTMLImageElement | null = null;

  private readonly FALLBACK_CANVAS_WIDTH = 640;
  private readonly PANEL_ASPECT_RATIO = 4 / 3;
  private readonly FALLBACK_CANVAS_HEIGHT = Math.round(
    this.FALLBACK_CANVAS_WIDTH / this.PANEL_ASPECT_RATIO,
  );

  constructor(defaultImageUrl?: string, onReady?: () => void, onError?: (message: string) => void) {
    const imageCanvas = requireElement<HTMLCanvasElement>("modular-image");
    const imageOverlayCanvas = requireElement<HTMLCanvasElement>("modular-image-overlay");
    const imageInput = requireElement<HTMLInputElement>("modular-image-upload");

    this.elements = { imageCanvas, imageOverlayCanvas, imageInput };
    this.sampler = new HSVImageSampler();
    this.attachUploadListener();
    this.resizeCanvases();
    window.addEventListener("resize", () => this.resizeCanvases());

    if (defaultImageUrl) {
      this.setImageAsset(defaultImageUrl, onReady, onError);
    }
  }

  public drawImageToCanvas(img: HTMLImageElement): void {
    const { imageCanvas } = this.elements;
    imageCanvas.width = img.naturalWidth || 640;
    imageCanvas.height = img.naturalHeight || 480;
    const imageCtx = imageCanvas.getContext("2d");
    if (!imageCtx) {
      throw new Error("HSV sampler could not acquire image canvas context.");
    }
    imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    imageCtx.drawImage(img, 0, 0, imageCanvas.width, imageCanvas.height);
  }

  public async loadSamplerFromImage(img: HTMLImageElement): Promise<void> {
    this.drawImageToCanvas(img);
    await this.sampler.loadImage(this.elements.imageCanvas);
    this.state.samplerReady = true;
    this.lastImage = img;
  }

  public setImageAsset(
    url: string,
    onReady?: () => void,
    onError?: (message: string) => void,
  ): void {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      await this.loadSamplerFromImage(img);
      onReady?.();
    };
    img.onerror = () => {
      const message = "Failed to load base image for HSV sampler";
      console.error(message);
      onError?.(message);
    };
    img.src = url;
  }

  public attachUploadListener(): void {
    const { imageInput } = this.elements;
    imageInput.addEventListener("change", (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = async () => {
        await this.loadSamplerFromImage(img);
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        console.error("Failed to load custom image for HSV sampler");
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
  }

  public resizeCanvases(defaultImage?: HTMLImageElement): void {
    const { imageCanvas, imageOverlayCanvas } = this.elements;
    [imageCanvas, imageOverlayCanvas].forEach((canvas) => {
      const { width, height } = this.measureCanvasSize(canvas);
      canvas.width = width;
      canvas.height = height;
    });

    if (this.state.samplerReady && defaultImage?.complete) {
      this.drawImageToCanvas(defaultImage);
      this.lastImage = defaultImage;
    } else if (this.state.samplerReady && this.lastImage) {
      this.drawImageToCanvas(this.lastImage);
    }
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
