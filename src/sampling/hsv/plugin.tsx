import { Image as ImageIcon } from "lucide-react";
import type { PluginTabMeta, PluginUISlots, SamplerHandle, SamplingPlugin } from "#src/core/plugin";
import { HSVSettingsPanel } from "./components/SettingsPanel";
import { HSVToolbarItems } from "./components/ToolbarItems";
import { curatedImages } from "./data/curatedImages";
import { HSVImageSampler } from "./HSVImageSampler";
import { drawImageToCanvas, resizeCanvasToContainer } from "./imageDrawing";
import { hsvSamplingRefs } from "./refs";
import { useHSVSamplingStore } from "./store";

const settingsTab: PluginTabMeta = {
  key: "image",
  label: "Image",
  icon: <ImageIcon className="h-3.5 w-3.5" />,
};

const ui: PluginUISlots = {
  SettingsPanel: HSVSettingsPanel,
  ToolbarItems: HSVToolbarItems,
};

/**
 * Load an image from a URL into an HTMLImageElement.
 */
const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });

export const hsvSamplingPlugin: SamplingPlugin = {
  kind: "sampling",
  id: "hsv-color",
  displayName: "HSV Color",
  settingsTab,
  ui,

  createSampler(): SamplerHandle {
    const sampler = new HSVImageSampler();
    let imageBuffer: HTMLImageElement | null = null;
    let storeUnsub: (() => void) | null = null;
    let resizeHandler: (() => void) | null = null;

    const getCanvas = () => hsvSamplingRefs.imageCanvas?.current ?? null;

    const drawAndEncode = async (img: HTMLImageElement, canvas: HTMLCanvasElement) => {
      const { imageCover, imagePan } = useHSVSamplingStore.getState();
      resizeCanvasToContainer(canvas);
      const drawn = drawImageToCanvas(canvas, img, imageCover, imagePan);
      if (!drawn) return;
      await sampler.loadImage(canvas);
      useHSVSamplingStore.getState().setImageReady(true);
      window.dispatchEvent(new Event("herakoi-image-rendered"));
    };

    const loadAndDraw = async (src: string) => {
      const canvas = getCanvas();
      if (!canvas) return;
      const img = await loadImageElement(src);
      useHSVSamplingStore.getState().setImagePan({ x: 0, y: 0 });
      imageBuffer = img;
      await drawAndEncode(img, canvas);
    };

    return {
      sampler,

      async postInitialize() {
        const canvas = getCanvas();
        if (!canvas) {
          throw new Error(
            "HSV sampling plugin: image canvas not mounted. Register ref before calling postInitialize.",
          );
        }

        // Restore image from store or load default curated
        const { currentImageSrc } = useHSVSamplingStore.getState();
        const initialSrc = currentImageSrc ?? curatedImages[0]?.src;
        if (initialSrc) {
          await loadAndDraw(initialSrc);
          if (!currentImageSrc && initialSrc) {
            useHSVSamplingStore.getState().setCurrentImageSrc(initialSrc);
          }
        }

        // Subscribe to store changes for runtime updates
        storeUnsub = useHSVSamplingStore.subscribe((state, prev) => {
          const canvas = getCanvas();
          if (!canvas) return;

          // Image source changed — load new image
          if (state.currentImageSrc !== prev.currentImageSrc && state.currentImageSrc) {
            void loadAndDraw(state.currentImageSrc);
            return;
          }

          // Cover or pan changed — redraw current image
          if (
            imageBuffer &&
            (state.imageCover !== prev.imageCover ||
              state.imagePan.x !== prev.imagePan.x ||
              state.imagePan.y !== prev.imagePan.y)
          ) {
            void drawAndEncode(imageBuffer, canvas);
          }
        });

        // Window resize handler
        resizeHandler = () => {
          const canvas = getCanvas();
          if (!canvas || !imageBuffer) return;
          void drawAndEncode(imageBuffer, canvas);
        };
        window.addEventListener("resize", resizeHandler);
      },

      cleanup() {
        storeUnsub?.();
        storeUnsub = null;
        if (resizeHandler) {
          window.removeEventListener("resize", resizeHandler);
          resizeHandler = null;
        }
        imageBuffer = null;
        useHSVSamplingStore.getState().setImageReady(false);
      },
    };
  },
};
