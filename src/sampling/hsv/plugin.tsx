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
    let panZoomCleanup: (() => void) | null = null;

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

      setCanvasRefs: (refs) => {
        // Register image canvas ref
        if (refs.imageCanvas) {
          hsvSamplingRefs.imageCanvas = refs.imageCanvas;
        }
      },

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

        // Image pan/zoom interaction (converted from useImageCoverPan hook)
        const setupPanZoom = () => {
          const canvas = getCanvas();
          if (!canvas) return null;

          const { imageCover } = useHSVSamplingStore.getState();

          // Update cursor styles
          canvas.style.cursor = imageCover ? "grab" : "default";
          canvas.style.touchAction = imageCover ? "none" : "auto";

          if (!imageCover) return null;

          // Pan/drag state
          let dragging = false;
          let lastX = 0;
          let lastY = 0;
          let rafId = 0;
          let pendingX = 0;
          let pendingY = 0;

          const applyPan = () => {
            if (!pendingX && !pendingY) return;
            const current = useHSVSamplingStore.getState().imagePan;
            useHSVSamplingStore.getState().setImagePan({
              x: current.x + pendingX,
              y: current.y + pendingY,
            });
            pendingX = 0;
            pendingY = 0;
          };

          const onPointerDown = (event: PointerEvent) => {
            if (event.button !== 0) return;
            dragging = true;
            lastX = event.clientX;
            lastY = event.clientY;
            canvas.style.cursor = "grabbing";
            canvas.setPointerCapture(event.pointerId);
          };

          const onPointerMove = (event: PointerEvent) => {
            if (!dragging) return;
            const dx = event.clientX - lastX;
            const dy = event.clientY - lastY;
            lastX = event.clientX;
            lastY = event.clientY;
            pendingX += dx;
            pendingY += dy;
            if (!rafId) {
              rafId = requestAnimationFrame(() => {
                rafId = 0;
                applyPan();
              });
            }
          };

          const endDrag = (event: PointerEvent) => {
            if (!dragging) return;
            dragging = false;
            if (canvas.hasPointerCapture(event.pointerId)) {
              canvas.releasePointerCapture(event.pointerId);
            }
            canvas.style.cursor = "grab";
            if (rafId) {
              cancelAnimationFrame(rafId);
              rafId = 0;
            }
            applyPan();
          };

          canvas.addEventListener("pointerdown", onPointerDown);
          window.addEventListener("pointermove", onPointerMove);
          window.addEventListener("pointerup", endDrag);
          window.addEventListener("pointercancel", endDrag);

          return () => {
            canvas.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", endDrag);
            window.removeEventListener("pointercancel", endDrag);
            canvas.style.cursor = "default";
            canvas.style.touchAction = "auto";
            if (rafId) cancelAnimationFrame(rafId);
          };
        };

        // Initial setup
        panZoomCleanup = setupPanZoom();

        // Re-setup when imageCover changes
        const panZoomUnsub = useHSVSamplingStore.subscribe((state, prev) => {
          if (state.imageCover !== prev.imageCover) {
            panZoomCleanup?.();
            panZoomCleanup = setupPanZoom();
          }
        });

        // Combine cleanup with existing store cleanup
        const originalStoreUnsub = storeUnsub;
        storeUnsub = () => {
          originalStoreUnsub?.();
          panZoomUnsub();
        };
      },

      cleanup() {
        storeUnsub?.();
        storeUnsub = null;
        if (resizeHandler) {
          window.removeEventListener("resize", resizeHandler);
          resizeHandler = null;
        }
        panZoomCleanup?.();
        panZoomCleanup = null;
        imageBuffer = null;
        useHSVSamplingStore.getState().setImageReady(false);
      },
    };
  },
};
