/**
 * Lifecycle shared by image-based sampling plugins.
 *
 * Why: every image sampler draws an image on the shell's canvas, keeps it in step with
 * window size and the cover viewport (pan, zoom, rotate), restores the last chosen image
 * and reloads it when the config changes. Only how an image is loaded and encoded for
 * sampling differs between plugins.
 * What: createImageSamplerHandle() returns a SamplerHandle; the plugin passes its sampler,
 * its runtime store and three hooks: loadBuffer (source → buffer), getDrawable (buffer →
 * what is shown) and encode (prepare the sampler after each draw).
 * How: loads are versioned so an older, slower load never replaces a newer one; the
 * viewport and pan interaction are driven by the runtime store.
 */

import type { ErrorOr, ImageSampler } from "#src/core/interfaces";
import type { SamplerHandle } from "#src/core/plugin";
import {
  type DrawableImage,
  drawImageToCanvas,
  type ImageLayout,
  resizeCanvasToContainer,
} from "./drawing";
import type { ImageRuntimeStore } from "./runtimeStore";
import type { ImageViewportMode, VisibleRect } from "./types";

export type ImageSamplerHandleOptions<TBuffer> = {
  sampler: ImageSampler;
  store: ImageRuntimeStore;
  /** Name used in error messages. */
  label: string;
  getCurrentImageId: () => string | null;
  setCurrentImageId: (id: string) => void;
  /** Subscribe to the plugin's config; the listener runs on every change. */
  subscribeConfig: (listener: () => void) => () => void;
  resolveImageSource: (id: string | null | undefined) => string | null;
  getDefaultImageId: () => string | null;
  /** Load an image source into whatever the plugin draws and samples. */
  loadBuffer: (src: string, imageId: string) => Promise<TBuffer>;
  getDrawable: (buffer: TBuffer) => DrawableImage;
  /** Prepare the sampler after the image was drawn on `canvas` with `layout`. */
  encode: (
    buffer: TBuffer,
    canvas: HTMLCanvasElement,
    layout: ImageLayout,
  ) => ErrorOr<undefined> | Promise<ErrorOr<undefined>>;
  /**
   * On a config change that kept the same image: return a new buffer to redraw
   * (e.g. a new layer mapping), or null to keep the current one.
   */
  refreshBuffer?: (buffer: TBuffer) => TBuffer | null;
  /** Extra teardown, run on dispose. */
  onDispose?: () => void;
};

const isViewportModeEqual = (left: ImageViewportMode, right: ImageViewportMode) => {
  if (left.kind === "contain") return right.kind === "contain";
  if (right.kind !== "cover") return false;
  return (
    left.pan.x === right.pan.x &&
    left.pan.y === right.pan.y &&
    left.zoom === right.zoom &&
    (left.rotation ?? 0) === (right.rotation ?? 0)
  );
};

const normalizeRotation = (rotation: number | undefined) => {
  const value = Number.isFinite(rotation) ? (rotation as number) : 0;
  let normalized = ((value + 180) % 360) - 180;
  if (normalized < -180) normalized += 360;
  return normalized;
};

export const createImageSamplerHandle = <TBuffer>(
  options: ImageSamplerHandleOptions<TBuffer>,
): SamplerHandle => {
  const { sampler, store } = options;
  let imageCanvasRef: { current: HTMLCanvasElement | null } | null = null;
  let imageBuffer: TBuffer | null = null;
  let configUnsub: (() => void) | null = null;
  let resizeHandler: (() => void) | null = null;
  let panZoomCleanup: (() => void) | null = null;
  let loadRequestVersion = 0;
  let visibleRect: VisibleRect | null = null;

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
    store.getState().setCoverModeActive(false);
    store.getState().setPanInteractionEnabled(false);
    store.getState().setViewportMode({ kind: "cover", pan: { x: 0, y: 0 }, zoom: 1, rotation: 0 });
    store.getState().setImageReady(false);
    options.onDispose?.();
  };

  const getCanvas = () => imageCanvasRef?.current ?? null;
  const getViewportMode = (): ImageViewportMode => store.getState().viewportMode;
  const getPanInteractionEnabled = (): boolean => store.getState().panInteractionEnabled;
  const setViewportMode = (mode: ImageViewportMode) => {
    store.getState().setViewportMode(mode);
  };

  const drawAndEncode = async (buffer: TBuffer, canvas: HTMLCanvasElement) => {
    const viewportMode = getViewportMode();
    resizeCanvasToContainer(canvas);
    const layout = drawImageToCanvas(canvas, options.getDrawable(buffer), viewportMode);
    if (!layout) return;
    const visibleX = Math.max(0, layout.x);
    const visibleY = Math.max(0, layout.y);
    const visibleWidth = Math.min(layout.x + layout.width, canvas.width) - visibleX;
    const visibleHeight = Math.min(layout.y + layout.height, canvas.height) - visibleY;
    visibleRect = { x: visibleX, y: visibleY, width: visibleWidth, height: visibleHeight };
    const loadError = await options.encode(buffer, canvas, layout);
    if (loadError instanceof Error) {
      throw loadError;
    }
    store.getState().setImageReady(true);
  };

  const loadAndDraw = async (src: string, imageId: string) => {
    const canvas = getCanvas();
    if (!canvas) return;
    const requestVersion = ++loadRequestVersion;
    const buffer = await options.loadBuffer(src, imageId);
    if (requestVersion !== loadRequestVersion) return;
    const currentViewportMode = getViewportMode();
    if (currentViewportMode.kind === "cover") {
      setViewportMode({
        ...currentViewportMode,
        pan: { x: 0, y: 0 },
      });
    }
    if (requestVersion !== loadRequestVersion) return;
    imageBuffer = buffer;
    await drawAndEncode(buffer, canvas);
  };

  const redraw = () => {
    const canvas = getCanvas();
    if (!canvas || imageBuffer === null) return;
    void drawAndEncode(imageBuffer, canvas).catch((error) => {
      console.error(`${options.label}: failed to draw image.`, error);
    });
  };

  return {
    sampler,

    getVisibleRect: () => visibleRect,

    setCanvasRefs: (refs) => {
      if (refs.imageCanvas) {
        imageCanvasRef = refs.imageCanvas;
      }
    },

    async postInitialize() {
      const canvas = getCanvas();
      if (!canvas) {
        throw new Error(
          `${options.label}: image canvas not mounted. Register ref before calling postInitialize.`,
        );
      }

      // Restore selected image by stable id; fallback to default bundled image.
      const currentImageId = options.getCurrentImageId();
      const defaultImageId = options.getDefaultImageId();
      const configuredSrc = options.resolveImageSource(currentImageId);
      const fallbackSrc = options.resolveImageSource(defaultImageId);
      const initialImageId = configuredSrc ? currentImageId : defaultImageId;
      const initialSrc = configuredSrc ?? fallbackSrc;
      if (initialSrc && initialImageId) {
        let loadedImageId = initialImageId;
        try {
          await loadAndDraw(initialSrc, initialImageId);
        } catch (error) {
          // A stored upload that cannot be loaded any more falls back to the default image.
          if (initialSrc === fallbackSrc || !fallbackSrc || !defaultImageId) throw error;
          console.error(`${options.label}: failed to restore image.`, error);
          await loadAndDraw(fallbackSrc, defaultImageId);
          loadedImageId = defaultImageId;
        }
        if (currentImageId !== loadedImageId) {
          options.setCurrentImageId(loadedImageId);
        }
      }
      const runtimeState = store.getState();
      runtimeState.setViewportMode({
        kind: "cover",
        pan: { x: 0, y: 0 },
        zoom: 1,
        rotation: 0,
      });
      runtimeState.setPanInteractionEnabled(false);
      runtimeState.notifyCoverModeActivated();

      // Reload on image selection; let the plugin refresh the same image otherwise.
      let previousImageId = options.getCurrentImageId();
      configUnsub = options.subscribeConfig(() => {
        const nextImageId = options.getCurrentImageId();
        if (nextImageId !== previousImageId && nextImageId) {
          previousImageId = nextImageId;
          const source = options.resolveImageSource(nextImageId);
          if (source) {
            void loadAndDraw(source, nextImageId).catch((error) => {
              console.error(`${options.label}: failed to load image.`, error);
            });
          }
          return;
        }
        previousImageId = nextImageId;
        if (imageBuffer !== null && options.refreshBuffer) {
          const refreshed = options.refreshBuffer(imageBuffer);
          if (refreshed !== null) {
            imageBuffer = refreshed;
            redraw();
          }
        }
      });

      // Window resize handler
      resizeHandler = redraw;
      window.addEventListener("resize", resizeHandler);

      // Image pan/zoom interaction
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
            const nextZoom = Math.max(0.2, Math.min(10, gestureStart.viewport.zoom * zoomRatio));
            const deltaAngleDeg = ((gesture.angle - gestureStart.angle) * 180) / Math.PI;
            const nextRotation = normalizeRotation(gestureStart.viewport.rotation + deltaAngleDeg);
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
          const scale = Number.isFinite(gestureEvent.scale) ? (gestureEvent.scale as number) : 1;
          const rotation = Number.isFinite(gestureEvent.rotation)
            ? (gestureEvent.rotation as number)
            : 0;
          const nextZoom = Math.max(0.2, Math.min(10, webkitGestureStart.viewport.zoom * scale));
          const nextRotation = normalizeRotation(webkitGestureStart.viewport.rotation + rotation);
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
      const panZoomUnsub = store.subscribe((state, prevState) => {
        const viewportChanged = !isViewportModeEqual(state.viewportMode, prevState.viewportMode);
        const kindChanged = state.viewportMode.kind !== prevState.viewportMode.kind;
        const panInteractionChanged =
          state.panInteractionEnabled !== prevState.panInteractionEnabled;

        if (kindChanged) {
          if (state.viewportMode.kind === "cover") {
            store.getState().notifyCoverModeActivated();
          } else {
            store.getState().setCoverModeActive(false);
          }
        }

        if (viewportChanged) {
          redraw();
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
};
