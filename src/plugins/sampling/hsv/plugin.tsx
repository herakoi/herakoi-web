import type {
  PluginRuntimeContext,
  PluginUISlots,
  SamplerHandle,
  SamplingPluginDefinition,
} from "#src/core/plugin";
import { defineSamplingPlugin } from "#src/core/plugin";
import { HSVSettingsPanel } from "./components/SettingsPanel";
import { HSVToolbarItems } from "./components/ToolbarItems";
import { defaultHSVSamplingConfig, type HSVSamplingConfig, hsvSamplingPluginId } from "./config";
import { HSVImageSampler } from "./HSVImageSampler";
import { drawImageToCanvas, resizeCanvasToContainer } from "./imageDrawing";
import { getDefaultImageId, resolveImageSourceById } from "./lib/imageSourceResolver";
import { hsvSamplingRefs } from "./refs";
import { useHSVRuntimeStore } from "./runtimeStore";

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

const isViewportModeEqual = (
  left: HSVSamplingConfig["viewportMode"],
  right: HSVSamplingConfig["viewportMode"],
) => {
  if (left.kind === "contain") return right.kind === "contain";
  if (right.kind !== "cover") return false;
  return left.pan.x === right.pan.x && left.pan.y === right.pan.y && left.zoom === right.zoom;
};

export const plugin: SamplingPluginDefinition<typeof hsvSamplingPluginId, HSVSamplingConfig> =
  defineSamplingPlugin({
    id: hsvSamplingPluginId,
    displayName: "HSV Color",
    ui,
    config: {
      defaultConfig: defaultHSVSamplingConfig,
    },

    createSampler(
      config: HSVSamplingConfig,
      runtime: PluginRuntimeContext<HSVSamplingConfig>,
    ): SamplerHandle {
      const sampler = new HSVImageSampler();
      let imageBuffer: HTMLImageElement | null = null;
      let configUnsub: (() => void) | null = null;
      let resizeHandler: (() => void) | null = null;
      let panZoomCleanup: (() => void) | null = null;
      let loadRequestVersion = 0;
      let visibleRect: { x: number; y: number; width: number; height: number } | null = null;
      const dispose = () => {
        configUnsub?.();
        configUnsub = null;
        if (resizeHandler) {
          window.removeEventListener("resize", resizeHandler);
          resizeHandler = null;
        }
        panZoomCleanup?.();
        panZoomCleanup = null;
        loadRequestVersion += 1;
        imageBuffer = null;
        visibleRect = null;
        useHSVRuntimeStore.getState().setImageReady(false);
      };

      const getCanvas = () => hsvSamplingRefs.imageCanvas?.current ?? null;
      const getConfig = (): HSVSamplingConfig => runtime.getConfig();

      //TODO: estrarre queste logiche
      const drawAndEncode = async (img: HTMLImageElement, canvas: HTMLCanvasElement) => {
        const { viewportMode } = getConfig();
        resizeCanvasToContainer(canvas);
        const layout = drawImageToCanvas(canvas, img, viewportMode);
        if (!layout) return;
        const visibleX = Math.max(0, layout.x);
        const visibleY = Math.max(0, layout.y);
        const visibleWidth = Math.min(layout.x + layout.width, canvas.width) - visibleX;
        const visibleHeight = Math.min(layout.y + layout.height, canvas.height) - visibleY;
        visibleRect = { x: visibleX, y: visibleY, width: visibleWidth, height: visibleHeight };
        const loadError = await sampler.loadImage(canvas);
        if (loadError instanceof Error) {
          throw loadError;
        }
        useHSVRuntimeStore.getState().setImageReady(true);
      };

      const loadAndDraw = async (src: string) => {
        const canvas = getCanvas();
        if (!canvas) return;
        const requestVersion = ++loadRequestVersion;
        const img = await loadImageElement(src);
        if (requestVersion !== loadRequestVersion) return;
        const currentViewportMode = getConfig().viewportMode;
        if (currentViewportMode.kind === "cover") {
          runtime.setConfig({
            viewportMode: {
              ...currentViewportMode,
              pan: { x: 0, y: 0 },
            },
          });
        }
        if (requestVersion !== loadRequestVersion) return;
        imageBuffer = img;
        await drawAndEncode(img, canvas);
      };

      return {
        sampler,

        getVisibleRect: () => visibleRect,

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

          // Restore selected image by stable id; fallback to default bundled image.
          const { currentImageId } = getConfig();
          const defaultImageId = getDefaultImageId();
          const configuredSrc = resolveImageSourceById(currentImageId);
          const fallbackSrc = resolveImageSourceById(defaultImageId);
          const initialImageId = configuredSrc ? currentImageId : defaultImageId;
          const initialSrc = configuredSrc ?? fallbackSrc;
          if (initialSrc && initialImageId) {
            await loadAndDraw(initialSrc);
            if (currentImageId !== initialImageId) {
              runtime.setConfig({ currentImageId: initialImageId });
            }
          }

          // Subscribe to config changes for runtime updates
          let previousConfig = { ...config };
          configUnsub = runtime.subscribeConfig((currentConfig) => {
            const canvas = getCanvas();
            if (!canvas) return;

            // Selected image changed — resolve source and load.
            if (
              currentConfig.currentImageId !== previousConfig.currentImageId &&
              currentConfig.currentImageId
            ) {
              previousConfig = { ...currentConfig };
              const source = resolveImageSourceById(currentConfig.currentImageId);
              if (source) {
                void loadAndDraw(source);
              }
              return;
            }

            // Viewport mode changed — redraw current image
            if (
              imageBuffer &&
              !isViewportModeEqual(currentConfig.viewportMode, previousConfig.viewportMode)
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

            const { viewportMode } = getConfig();
            const coverModeEnabled = viewportMode.kind === "cover";

            // Update cursor styles
            canvas.style.cursor = coverModeEnabled ? "grab" : "default";
            canvas.style.touchAction = coverModeEnabled ? "none" : "auto";

            if (!coverModeEnabled) return null;

            // Pan/drag state
            let dragging = false;
            let lastX = 0;
            let lastY = 0;
            let rafId = 0;
            let pendingX = 0;
            let pendingY = 0;

            const applyPan = () => {
              if (!pendingX && !pendingY) return;
              const currentViewportMode = getConfig().viewportMode;
              if (currentViewportMode.kind !== "cover") return;
              runtime.setConfig({
                viewportMode: {
                  ...currentViewportMode,
                  pan: {
                    x: currentViewportMode.pan.x + pendingX,
                    y: currentViewportMode.pan.y + pendingY,
                  },
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

          // Re-setup when viewport mode kind changes
          let previousKind = getConfig().viewportMode.kind;
          const panZoomUnsub = runtime.subscribeConfig((currentConfig) => {
            const currentKind = currentConfig.viewportMode.kind;
            if (currentKind !== previousKind) {
              previousKind = currentKind;
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
          dispose();
        },
        [Symbol.dispose]: dispose,
      };
    },
  });
