import { type RefObject, useCallback, useEffect, useRef } from "react";
import { ApplicationController } from "#src/core/ApplicationController";
import type { DetectedPoint } from "#src/core/interfaces";
import type { PipelineConfig } from "#src/core/plugin";
import { type DebugToneSample, setupDebugTools } from "#src/debug";
import { registerOverlayRef } from "#src/detection/mediapipe/refs";
import { curatedImages } from "../data/curatedImages";
import { useNotificationStore } from "../state/notificationStore";
import { usePipelineStore } from "../state/pipelineStore";

type Refs = {
  imageCanvasRef: RefObject<HTMLCanvasElement>;
  imageOverlayRef: RefObject<HTMLCanvasElement>;
};

const resizeCanvasToContainer = (canvas: HTMLCanvasElement) => {
  const parent = canvas.parentElement;
  const rect = parent?.getBoundingClientRect();
  const width = Math.round(rect?.width ?? canvas.clientWidth ?? 640);
  const height = Math.round(rect?.height ?? canvas.clientHeight ?? Math.round(width * 0.75)) || 480;
  canvas.width = width;
  canvas.height = height;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const drawImageToCanvas = (
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  cover: boolean,
  pan: { x: number; y: number },
) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const scale = cover
    ? Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
    : Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const baseOffsetX = (canvas.width - drawWidth) / 2;
  const baseOffsetY = (canvas.height - drawHeight) / 2;
  const extraX = Math.max(0, (drawWidth - canvas.width) / 2);
  const extraY = Math.max(0, (drawHeight - canvas.height) / 2);
  const offsetX = cover
    ? clamp(baseOffsetX + pan.x, baseOffsetX - extraX, baseOffsetX + extraX)
    : baseOffsetX;
  const offsetY = cover
    ? clamp(baseOffsetY + pan.y, baseOffsetY - extraY, baseOffsetY + extraY)
    : baseOffsetY;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  return true;
};

export const usePipeline = (config: PipelineConfig, { imageCanvasRef, imageOverlayRef }: Refs) => {
  const status = usePipelineStore((state) => state.status);
  const error = usePipelineStore((state) => state.error);
  const imageReady = usePipelineStore((state) => state.imageReady);
  const setStatus = usePipelineStore((state) => state.setStatus);
  const setImageReady = usePipelineStore((state) => state.setImageReady);
  const setImagePan = usePipelineStore((state) => state.setImagePan);
  const imageCover = usePipelineStore((state) => state.imageCover);
  const imagePan = usePipelineStore((state) => state.imagePan);
  const activeDetectionId = usePipelineStore((state) => state.activeDetectionId);
  const activeSamplingId = usePipelineStore((state) => state.activeSamplingId);
  const activeSonificationId = usePipelineStore((state) => state.activeSonificationId);

  const detectorHandleRef = useRef<ReturnType<
    (typeof config.detection)[0]["createDetector"]
  > | null>(null);
  const samplerHandleRef = useRef<ReturnType<(typeof config.sampling)[0]["createSampler"]> | null>(
    null,
  );
  const sonifierHandleRef = useRef<ReturnType<
    (typeof config.sonification)[0]["createSonifier"]
  > | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const controllerRef = useRef<ApplicationController | null>(null);
  const imageBufferRef = useRef<HTMLImageElement | null>(null);
  const debugToolsRef = useRef<ReturnType<typeof setupDebugTools> | null>(null);

  const ensureCanvasesSized = useCallback(() => {
    if (imageCanvasRef.current) resizeCanvasToContainer(imageCanvasRef.current);
    if (imageOverlayRef.current) resizeCanvasToContainer(imageOverlayRef.current);
  }, [imageCanvasRef, imageOverlayRef]);

  const syncDebugPanel = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const debugEnabled = new URLSearchParams(window.location.search).has("dev");
    if (!debugEnabled) {
      debugToolsRef.current?.logToneSamples([]);
      debugToolsRef.current = null;
      const panel = document.getElementById("herakoi-debug-panel");
      if (panel) {
        panel.remove();
      }
      return;
    }

    if (!debugToolsRef.current) {
      debugToolsRef.current = setupDebugTools();
    }
  }, []);

  const loadImage = useCallback(
    async (src: string) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
      });
      img.src = src;
      const loaded = await loadPromise;
      setImagePan({ x: 0, y: 0 });
      imageBufferRef.current = loaded;
      const canvas = imageCanvasRef.current;
      if (!canvas) {
        throw new Error("Image canvas missing for sampler load");
      }
      resizeCanvasToContainer(canvas);
      const { imageCover: cover, imagePan: currentPan } = usePipelineStore.getState();
      const drawn = drawImageToCanvas(canvas, loaded, cover, currentPan);
      if (!drawn) {
        throw new Error("Unable to acquire 2D context for image canvas");
      }
      await samplerHandleRef.current?.sampler.loadImage(canvas);
      setImageReady(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("herakoi-image-rendered"));
      }
    },
    [imageCanvasRef, setImagePan, setImageReady],
  );

  const loadImageFile = useCallback(
    async (file: File) => {
      const objectUrl = URL.createObjectURL(file);
      try {
        await loadImage(objectUrl);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    },
    [loadImage],
  );

  const loadImageSource = useCallback(
    async (src: string) => {
      await loadImage(src);
    },
    [loadImage],
  );

  const start = useCallback(async () => {
    if (!imageCanvasRef.current) {
      return;
    }
    try {
      setStatus("initializing");

      // Resolve active plugins
      const activeDetection = config.detection.find((p) => p.id === activeDetectionId);
      const activeSampling = config.sampling.find((p) => p.id === activeSamplingId);
      const activeSonification = config.sonification.find((p) => p.id === activeSonificationId);

      if (!activeDetection || !activeSampling || !activeSonification) {
        throw new Error(
          "Invalid active plugin configuration. Check pipelineConfig and active IDs in store.",
        );
      }

      // Register image overlay ref for detection plugin
      if (imageOverlayRef.current) {
        registerOverlayRef("imageOverlay", imageOverlayRef);
      }

      // Create plugin instances
      const dh = activeDetection.createDetector();
      const sh = activeSampling.createSampler();
      const soh = activeSonification.createSonifier();

      detectorHandleRef.current = dh;
      samplerHandleRef.current = sh;
      sonifierHandleRef.current = soh;

      // Wire up pipeline events
      activeDetection.bindPipelineEvents(dh.detector, {
        showNotification: useNotificationStore.getState().show,
        hideNotification: useNotificationStore.getState().hide,
      });

      // Create and start controller
      const controller = new ApplicationController(dh.detector, sh.sampler, soh.sonifier);
      controllerRef.current = controller;
      syncDebugPanel();

      // Debug logging
      const logDebugSamples = (points: DetectedPoint[]) => {
        const debugEnabled = new URLSearchParams(window.location.search).has("dev");
        if (!debugEnabled) {
          return;
        }

        if (!debugToolsRef.current) {
          debugToolsRef.current = setupDebugTools();
        }

        const debugTools = debugToolsRef.current;
        if (!debugTools) return;

        const sampler = samplerHandleRef.current?.sampler;
        const state = usePipelineStore.getState();
        if (!sampler || !state.imageReady) {
          debugTools.logToneSamples([]);
          return;
        }

        const debugToneSamples: DebugToneSample[] = [];
        for (const point of points) {
          const sample = sampler.sampleAt(point) as {
            data?: {
              hueByte?: number;
              saturationByte?: number;
              valueByte?: number;
            };
          } | null;
          if (!sample?.data) {
            continue;
          }

          const hueByte = sample.data.hueByte ?? 0;
          const valueByte = sample.data.valueByte ?? 0;
          const frequency =
            state.oscillator.minFreq +
            (hueByte / 255) * (state.oscillator.maxFreq - state.oscillator.minFreq);
          const volume =
            state.oscillator.minVol +
            (valueByte / 255) * (state.oscillator.maxVol - state.oscillator.minVol);

          debugToneSamples.push({
            toneId: point.id,
            frequency,
            volume,
            hueByte,
            saturationByte: sample.data.saturationByte ?? 0,
            valueByte,
          });
        }

        debugTools.logToneSamples(debugToneSamples);
      };

      dh.detector.onPointsDetected(logDebugSamples);

      ensureCanvasesSized();
      if (imageBufferRef.current && imageCanvasRef.current) {
        const canvas = imageCanvasRef.current;
        const { imageCover: cover, imagePan: currentPan } = usePipelineStore.getState();
        const drawn = drawImageToCanvas(canvas, imageBufferRef.current, cover, currentPan);
        if (!drawn) {
          throw new Error("Unable to acquire 2D context for image canvas");
        }
        await sh.sampler.loadImage(canvas);
        setImageReady(true);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("herakoi-image-rendered"));
        }
      } else {
        const fallback = curatedImages[0];
        if (fallback) {
          await loadImage(fallback.src);
        } else {
          setImageReady(false);
        }
      }

      await controller.start();

      // Run post-initialize hooks
      dh.postInitialize?.();

      // Initialize analyser after controller has started and sonifier is ready
      if (
        sonifierHandleRef.current?.extras?.getAnalyser &&
        typeof sonifierHandleRef.current.extras.getAnalyser === "function"
      ) {
        analyserRef.current = (
          sonifierHandleRef.current.extras.getAnalyser as (options?: {
            fftSize?: number;
            smoothingTimeConstant?: number;
          }) => AnalyserNode | null
        )({
          fftSize: 2048,
          smoothingTimeConstant: 0.65,
        });
      }

      setStatus("running");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error while starting pipeline";
      setStatus("error", message);
      console.error("Pipeline start failed:", error);
    }
  }, [
    config,
    activeDetectionId,
    activeSamplingId,
    activeSonificationId,
    ensureCanvasesSized,
    imageCanvasRef,
    imageOverlayRef,
    loadImage,
    setStatus,
    setImageReady,
    syncDebugPanel,
  ]);

  const stop = useCallback(() => {
    controllerRef.current?.stop();
    detectorHandleRef.current?.cleanup?.();
    samplerHandleRef.current?.cleanup?.();
    sonifierHandleRef.current?.cleanup?.();
    analyserRef.current = null;
    useNotificationStore.getState().clearAll();
    usePipelineStore.getState().setUiOpacity(1);
    setStatus("idle");
  }, [setStatus]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => ensureCanvasesSized();
    const rerenderImage = () => {
      if (imageBufferRef.current && imageCanvasRef.current) {
        const canvas = imageCanvasRef.current;
        resizeCanvasToContainer(canvas);
        drawImageToCanvas(canvas, imageBufferRef.current, imageCover, imagePan);
      }
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("resize", rerenderImage);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", rerenderImage);
    };
  }, [ensureCanvasesSized, imageCanvasRef, imageCover, imagePan]);

  // Re-render image when cover or pan changes
  useEffect(() => {
    if (!imageBufferRef.current || !imageCanvasRef.current) return;
    const canvas = imageCanvasRef.current;
    resizeCanvasToContainer(canvas);
    const drawn = drawImageToCanvas(canvas, imageBufferRef.current, imageCover, imagePan);
    if (drawn) {
      void samplerHandleRef.current?.sampler.loadImage(canvas);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("herakoi-image-rendered"));
      }
    }
  }, [imageCover, imageCanvasRef, imagePan]);

  // Debug panel toggle
  useEffect(() => {
    if (typeof window === "undefined") return;
    syncDebugPanel();
    const handleToggle = () => syncDebugPanel();
    window.addEventListener("herakoi-debug-toggle", handleToggle);
    return () => window.removeEventListener("herakoi-debug-toggle", handleToggle);
  }, [syncDebugPanel]);

  return {
    start,
    stop,
    status,
    error,
    imageReady,
    loadImageFile,
    loadImageSource,
    // Expose analyser access for visualizations
    analyser: analyserRef,
  };
};
