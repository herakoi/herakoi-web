import { Image as ImageIcon } from "lucide-react";
import { useAppConfigStore } from "#src/app/state/appConfigStore";
import type { PluginTabMeta, PluginUISlots, SamplerHandle, SamplingPlugin } from "#src/core/plugin";
import type { HSVSamplingConfig } from "#src/core/pluginConfig";
import { HSVSettingsPanel } from "./components/SettingsPanel";
import { HSVToolbarItems } from "./components/ToolbarItems";
import { curatedImages } from "./data/curatedImages";
import { HSVImageSampler } from "./HSVImageSampler";
import { drawImageToCanvas, resizeCanvasToContainer } from "./imageDrawing";
import { hsvSamplingRefs } from "./refs";
import { useHSVRuntimeStore } from "./runtimeStore";

const settingsTab: PluginTabMeta = {
  key: "image",
  label: "Image",
  icon: <ImageIcon className="h-3.5 w-3.5" />,
};

const ui: PluginUISlots<HSVSamplingConfig> = {
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

export const hsvSamplingPlugin: SamplingPlugin<"hsv-color"> = {
  kind: "sampling",
  id: "hsv-color",
  displayName: "HSV Color",
  settingsTab,
  ui,

  createSampler(config: HSVSamplingConfig): SamplerHandle {
    const sampler = new HSVImageSampler();
    let imageBuffer: HTMLImageElement | null = null;
    let configUnsub: (() => void) | null = null;
    let resizeHandler: (() => void) | null = null;
    let panZoomCleanup: (() => void) | null = null;

    const getCanvas = () => hsvSamplingRefs.imageCanvas?.current ?? null;

    const drawAndEncode = async (img: HTMLImageElement, canvas: HTMLCanvasElement) => {
      const { imageCover, imagePan } = useAppConfigStore.getState().pluginConfigs["hsv-color"];
      resizeCanvasToContainer(canvas);
      const drawn = drawImageToCanvas(canvas, img, imageCover, imagePan);
      if (!drawn) return;
      await sampler.loadImage(canvas);
      useHSVRuntimeStore.getState().setImageReady(true);
      window.dispatchEvent(new Event("herakoi-image-rendered"));
    };

    const loadAndDraw = async (src: string) => {
      const canvas = getCanvas();
      if (!canvas) return;
      const img = await loadImageElement(src);
      useAppConfigStore.getState().setPluginConfig("hsv-color", { imagePan: { x: 0, y: 0 } });
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

        // Restore image from config or load default curated
        // TODO: trovare un modo per cui la src dell'immagine non sia salvata in config in modo da poter creare un url condivisibile
        const { currentImageSrc } = useAppConfigStore.getState().pluginConfigs["hsv-color"];
        const initialSrc = currentImageSrc ?? curatedImages[0]?.src;
        if (initialSrc) {
          await loadAndDraw(initialSrc);
          if (!currentImageSrc && initialSrc) {
            useAppConfigStore
              .getState()
              .setPluginConfig("hsv-color", { currentImageSrc: initialSrc });
          }
        }

        // Subscribe to config changes for runtime updates
        let previousConfig = { ...config };
        configUnsub = useAppConfigStore.subscribe((state) => {
          const canvas = getCanvas();
          if (!canvas) return;

          const currentConfig = state.pluginConfigs["hsv-color"];

          // Image source changed — load new image
          if (
            currentConfig.currentImageSrc !== previousConfig.currentImageSrc &&
            currentConfig.currentImageSrc
          ) {
            previousConfig = { ...currentConfig };
            void loadAndDraw(currentConfig.currentImageSrc);
            return;
          }

          // Cover or pan changed — redraw current image
          if (
            imageBuffer &&
            (currentConfig.imageCover !== previousConfig.imageCover ||
              currentConfig.imagePan.x !== previousConfig.imagePan.x ||
              currentConfig.imagePan.y !== previousConfig.imagePan.y)
          ) {
            previousConfig = { ...currentConfig };
            void drawAndEncode(imageBuffer, canvas);
          }
        });

        // TODO: possiamo spostare questo flusso in un'altra parte della logica?
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

          const { imageCover } = useAppConfigStore.getState().pluginConfigs["hsv-color"];

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
            const current = useAppConfigStore.getState().pluginConfigs["hsv-color"].imagePan;
            useAppConfigStore.getState().setPluginConfig("hsv-color", {
              imagePan: {
                x: current.x + pendingX,
                y: current.y + pendingY,
              },
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
        let prevCover = useAppConfigStore.getState().pluginConfigs["hsv-color"].imageCover;
        const panZoomUnsub = useAppConfigStore.subscribe((state) => {
          const currentCover = state.pluginConfigs["hsv-color"].imageCover;
          if (currentCover !== prevCover) {
            prevCover = currentCover;
            panZoomCleanup?.();
            panZoomCleanup = setupPanZoom();
          }
        });

        // Combine cleanup with existing config cleanup
        const originalConfigUnsub = configUnsub;
        configUnsub = () => {
          originalConfigUnsub?.();
          panZoomUnsub();
        };
      },

      cleanup() {
        configUnsub?.();
        configUnsub = null;
        if (resizeHandler) {
          window.removeEventListener("resize", resizeHandler);
          resizeHandler = null;
        }
        panZoomCleanup?.();
        panZoomCleanup = null;
        imageBuffer = null;
        useHSVRuntimeStore.getState().setImageReady(false);
      },
    };
  },
};
