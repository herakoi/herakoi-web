import type {
  PluginRuntimeContext,
  PluginUISlots,
  SamplerHandle,
  SamplingPluginDefinition,
} from "#src/core/plugin";
import { defineSamplingPlugin } from "#src/core/plugin";
import { HSVNotifications } from "./components/Notifications";
import { HSVSettingsPanel } from "./components/SettingsPanel";
import { HSVToolbarItems } from "./components/ToolbarItems";
import {
  defaultHSVSamplingConfig,
  type HSVSamplingConfig,
  type HSVViewportMode,
  hsvSamplingPluginId,
} from "./config";
import { HSVImageSampler } from "./HSVImageSampler";
import { drawImageToCanvas, resizeCanvasToContainer } from "./imageDrawing";
import { getDefaultImageId, resolveImageSourceById } from "./lib/imageSourceResolver";
import { hsvSamplingRefs } from "./refs";
import { useHSVRuntimeStore } from "./runtimeStore";

const ui: PluginUISlots<HSVSamplingConfig> = {
  SettingsPanel: HSVSettingsPanel,
  ToolbarItems: HSVToolbarItems,
  Notifications: HSVNotifications,
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

const isViewportModeEqual = (left: HSVViewportMode, right: HSVViewportMode) => {
  if (left.kind === "contain") return right.kind === "contain";
  if (right.kind !== "cover") return false;
  return (
    left.pan.x === right.pan.x &&
    left.pan.y === right.pan.y &&
    left.zoom === right.zoom &&
    (left.rotation ?? 0) === (right.rotation ?? 0)
  );
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
        useHSVRuntimeStore.getState().setCoverModeActive(false);
        useHSVRuntimeStore.getState().setPanInteractionEnabled(false);
        useHSVRuntimeStore
          .getState()
          .setViewportMode({ kind: "cover", pan: { x: 0, y: 0 }, zoom: 1, rotation: 0 });
        useHSVRuntimeStore.getState().setImageReady(false);
      };

      const getCanvas = () => hsvSamplingRefs.imageCanvas?.current ?? null;
      const getConfig = (): HSVSamplingConfig => runtime.getConfig();
      const getViewportMode = (): HSVViewportMode => useHSVRuntimeStore.getState().viewportMode;
      const getPanInteractionEnabled = (): boolean =>
        useHSVRuntimeStore.getState().panInteractionEnabled;
      const setViewportMode = (mode: HSVViewportMode) => {
        useHSVRuntimeStore.getState().setViewportMode(mode);
      };
      const normalizeRotation = (rotation: number | undefined) => {
        const value = Number.isFinite(rotation) ? (rotation as number) : 0;
        let normalized = ((value + 180) % 360) - 180;
        if (normalized < -180) normalized += 360;
        return normalized;
      };

      //TODO: estrarre queste logiche
      const drawAndEncode = async (img: HTMLImageElement, canvas: HTMLCanvasElement) => {
        const viewportMode = getViewportMode();
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
        const currentViewportMode = getViewportMode();
        if (currentViewportMode.kind === "cover") {
          setViewportMode({
            ...currentViewportMode,
            pan: { x: 0, y: 0 },
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
          const runtimeState = useHSVRuntimeStore.getState();
          runtimeState.setViewportMode({
            kind: "cover",
            pan: { x: 0, y: 0 },
            zoom: 1,
            rotation: 0,
          });
          runtimeState.setPanInteractionEnabled(false);
          runtimeState.notifyCoverModeActivated();

          // Subscribe to persisted config changes (image selection only)
          let previousImageId = config.currentImageId;
          configUnsub = runtime.subscribeConfig((currentConfig) => {
            if (currentConfig.currentImageId !== previousImageId && currentConfig.currentImageId) {
              previousImageId = currentConfig.currentImageId;
              const source = resolveImageSourceById(currentConfig.currentImageId);
              if (source) {
                void loadAndDraw(source);
              }
            } else {
              previousImageId = currentConfig.currentImageId;
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

            const viewportMode = getViewportMode();
            const panInteractionEnabled = getPanInteractionEnabled();
            const panModeEnabled = viewportMode.kind === "cover" && panInteractionEnabled;

            // Update cursor styles
            canvas.style.cursor = panModeEnabled ? "grab" : "default";
            canvas.style.touchAction = panModeEnabled ? "none" : "auto";

            if (!panModeEnabled) return null;

            // Pan/gesture state
            const pointers = new Map<number, { x: number; y: number }>();
            let lastPanPoint: { x: number; y: number } | null = null;
            let gestureStart: {
              centroidX: number;
              centroidY: number;
              distance: number;
              angle: number;
              viewport: {
                kind: "cover";
                pan: { x: number; y: number };
                zoom: number;
                rotation: number;
              };
            } | null = null;
            let rafId = 0;
            let pendingX = 0;
            let pendingY = 0;
            let webkitGestureStart: {
              x: number;
              y: number;
              viewport: {
                kind: "cover";
                pan: { x: number; y: number };
                zoom: number;
                rotation: number;
              };
            } | null = null;

            const applyPan = () => {
              if (!pendingX && !pendingY) return;
              const currentViewportMode = getViewportMode();
              if (currentViewportMode.kind !== "cover") return;
              setViewportMode({
                ...currentViewportMode,
                rotation: currentViewportMode.rotation ?? 0,
                pan: {
                  x: currentViewportMode.pan.x + pendingX,
                  y: currentViewportMode.pan.y + pendingY,
                },
              });
              pendingX = 0;
              pendingY = 0;
            };

            const applyWheelZoom = (event: WheelEvent) => {
              const currentViewportMode = getViewportMode();
              if (currentViewportMode.kind !== "cover") return;

              const factor = Math.exp(-event.deltaY * 0.002);
              const nextZoom = Math.max(0.2, Math.min(10, currentViewportMode.zoom * factor));
              if (Math.abs(nextZoom - currentViewportMode.zoom) < 0.001) return;

              setViewportMode({
                ...currentViewportMode,
                zoom: nextZoom,
              });
            };

            const applyWheelRotate = (delta: number) => {
              const currentViewportMode = getViewportMode();
              if (currentViewportMode.kind !== "cover") return;
              const nextRotation = normalizeRotation(
                (currentViewportMode.rotation ?? 0) - delta * 0.15,
              );
              if (Math.abs(nextRotation - (currentViewportMode.rotation ?? 0)) < 0.01) return;
              setViewportMode({
                ...currentViewportMode,
                rotation: nextRotation,
              });
            };

            const isLikelyTrackpadWheel = (event: WheelEvent) => {
              if (event.deltaMode !== 0) return false;
              if (event.ctrlKey) return true;
              return Math.abs(event.deltaX) > 0 || Math.abs(event.deltaY) < 40;
            };

            const schedulePan = () => {
              if (rafId) return;
              rafId = requestAnimationFrame(() => {
                rafId = 0;
                applyPan();
              });
            };

            const toPointArray = () => [...pointers.values()];
            const getGestureFromPoints = (points: Array<{ x: number; y: number }>) => {
              const [a, b] = points;
              if (!a || !b) return null;
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              return {
                centroidX: (a.x + b.x) / 2,
                centroidY: (a.y + b.y) / 2,
                distance: Math.hypot(dx, dy),
                angle: Math.atan2(dy, dx),
              };
            };

            const onPointerDown = (event: PointerEvent) => {
              if (event.pointerType === "mouse" && event.button !== 0) return;

              pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
              if (pointers.size === 1) {
                lastPanPoint = { x: event.clientX, y: event.clientY };
                canvas.style.cursor = "grabbing";
              } else if (pointers.size >= 2) {
                applyPan();
                const gesture = getGestureFromPoints(toPointArray());
                const currentViewport = getViewportMode();
                if (gesture && currentViewport.kind === "cover") {
                  gestureStart = {
                    ...gesture,
                    viewport: {
                      ...currentViewport,
                      rotation: currentViewport.rotation ?? 0,
                    },
                  };
                }
                lastPanPoint = null;
                canvas.style.cursor = "grabbing";
              }
              canvas.setPointerCapture(event.pointerId);
            };

            const onPointerMove = (event: PointerEvent) => {
              if (!pointers.has(event.pointerId)) return;

              pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

              if (pointers.size === 1 && lastPanPoint) {
                const dx = event.clientX - lastPanPoint.x;
                const dy = event.clientY - lastPanPoint.y;
                lastPanPoint = { x: event.clientX, y: event.clientY };
                pendingX += dx;
                pendingY += dy;
                schedulePan();
                return;
              }

              if (pointers.size >= 2 && gestureStart) {
                const gesture = getGestureFromPoints(toPointArray());
                if (!gesture || gestureStart.distance <= 0) return;

                const zoomRatio = gesture.distance / gestureStart.distance;
                const nextZoom = Math.max(
                  0.2,
                  Math.min(10, gestureStart.viewport.zoom * zoomRatio),
                );
                const deltaAngleDeg = ((gesture.angle - gestureStart.angle) * 180) / Math.PI;
                const nextRotation = normalizeRotation(
                  gestureStart.viewport.rotation + deltaAngleDeg,
                );
                const deltaCentroidX = gesture.centroidX - gestureStart.centroidX;
                const deltaCentroidY = gesture.centroidY - gestureStart.centroidY;

                setViewportMode({
                  ...gestureStart.viewport,
                  zoom: nextZoom,
                  rotation: nextRotation,
                  pan: {
                    x: gestureStart.viewport.pan.x + deltaCentroidX,
                    y: gestureStart.viewport.pan.y + deltaCentroidY,
                  },
                });
              }
            };

            const onWheel = (event: WheelEvent) => {
              event.preventDefault();
              if (pointers.size > 0) return;
              const shiftRotationDelta = event.deltaY !== 0 ? event.deltaY : event.deltaX;

              const trackpadWheel = isLikelyTrackpadWheel(event);
              if (!trackpadWheel) {
                if (event.shiftKey) {
                  applyWheelRotate(shiftRotationDelta);
                  return;
                }
                applyWheelZoom(event);
                return;
              }

              // Trackpad gestures:
              // - pinch (ctrlKey) -> zoom
              // - shift + two-finger -> rotate
              // - two-finger scroll -> pan
              if (event.ctrlKey) {
                applyWheelZoom(event);
                return;
              }
              if (event.shiftKey) {
                applyWheelRotate(shiftRotationDelta);
                return;
              }

              pendingX += -event.deltaX;
              pendingY += -event.deltaY;
              schedulePan();
            };

            const onGestureStart = (event: Event) => {
              event.preventDefault();
              const currentViewportMode = getViewportMode();
              if (currentViewportMode.kind !== "cover") return;
              const gestureEvent = event as Event & { clientX?: number; clientY?: number };
              webkitGestureStart = {
                x: gestureEvent.clientX ?? 0,
                y: gestureEvent.clientY ?? 0,
                viewport: {
                  ...currentViewportMode,
                  rotation: currentViewportMode.rotation ?? 0,
                },
              };
            };

            const onGestureChange = (event: Event) => {
              event.preventDefault();
              if (!webkitGestureStart) return;
              const gestureEvent = event as Event & {
                scale?: number;
                rotation?: number;
                clientX?: number;
                clientY?: number;
              };
              const scale = Number.isFinite(gestureEvent.scale)
                ? (gestureEvent.scale as number)
                : 1;
              const rotation = Number.isFinite(gestureEvent.rotation)
                ? (gestureEvent.rotation as number)
                : 0;
              const nextZoom = Math.max(
                0.2,
                Math.min(10, webkitGestureStart.viewport.zoom * scale),
              );
              const nextRotation = normalizeRotation(
                webkitGestureStart.viewport.rotation + rotation,
              );
              const nextPanX =
                webkitGestureStart.viewport.pan.x +
                (gestureEvent.clientX ?? webkitGestureStart.x) -
                webkitGestureStart.x;
              const nextPanY =
                webkitGestureStart.viewport.pan.y +
                (gestureEvent.clientY ?? webkitGestureStart.y) -
                webkitGestureStart.y;

              setViewportMode({
                ...webkitGestureStart.viewport,
                zoom: nextZoom,
                rotation: nextRotation,
                pan: { x: nextPanX, y: nextPanY },
              });
            };

            const onGestureEnd = (event: Event) => {
              event.preventDefault();
              webkitGestureStart = null;
            };

            const endPointer = (event: PointerEvent) => {
              const hadPointer = pointers.delete(event.pointerId);
              if (!hadPointer) return;

              if (canvas.hasPointerCapture(event.pointerId)) {
                canvas.releasePointerCapture(event.pointerId);
              }

              if (pointers.size === 0) {
                lastPanPoint = null;
                gestureStart = null;
                canvas.style.cursor = "grab";
                if (rafId) {
                  cancelAnimationFrame(rafId);
                  rafId = 0;
                }
                applyPan();
                return;
              }

              if (pointers.size === 1) {
                const [remaining] = toPointArray();
                if (remaining) {
                  lastPanPoint = { ...remaining };
                }
                gestureStart = null;
              }
            };

            canvas.addEventListener("pointerdown", onPointerDown);
            canvas.addEventListener("pointermove", onPointerMove);
            canvas.addEventListener("pointerup", endPointer);
            canvas.addEventListener("pointercancel", endPointer);
            canvas.addEventListener("wheel", onWheel, { passive: false });
            canvas.addEventListener("gesturestart", onGestureStart as EventListener, {
              passive: false,
            });
            canvas.addEventListener("gesturechange", onGestureChange as EventListener, {
              passive: false,
            });
            canvas.addEventListener("gestureend", onGestureEnd as EventListener, {
              passive: false,
            });

            return () => {
              canvas.removeEventListener("pointerdown", onPointerDown);
              canvas.removeEventListener("pointermove", onPointerMove);
              canvas.removeEventListener("pointerup", endPointer);
              canvas.removeEventListener("pointercancel", endPointer);
              canvas.removeEventListener("wheel", onWheel);
              canvas.removeEventListener("gesturestart", onGestureStart as EventListener);
              canvas.removeEventListener("gesturechange", onGestureChange as EventListener);
              canvas.removeEventListener("gestureend", onGestureEnd as EventListener);
              canvas.style.cursor = "default";
              canvas.style.touchAction = "auto";
              if (rafId) cancelAnimationFrame(rafId);
            };
          };

          // Initial setup
          panZoomCleanup = setupPanZoom();

          // React to runtime viewport/pan interaction changes.
          const panZoomUnsub = useHSVRuntimeStore.subscribe((state, prevState) => {
            const viewportChanged = !isViewportModeEqual(
              state.viewportMode,
              prevState.viewportMode,
            );
            const kindChanged = state.viewportMode.kind !== prevState.viewportMode.kind;
            const panInteractionChanged =
              state.panInteractionEnabled !== prevState.panInteractionEnabled;

            if (kindChanged) {
              if (state.viewportMode.kind === "cover") {
                useHSVRuntimeStore.getState().notifyCoverModeActivated();
              } else {
                useHSVRuntimeStore.getState().setCoverModeActive(false);
              }
            }

            if (viewportChanged && imageBuffer) {
              const activeCanvas = getCanvas();
              if (activeCanvas) {
                void drawAndEncode(imageBuffer, activeCanvas);
              }
            }

            if (kindChanged || panInteractionChanged) {
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
