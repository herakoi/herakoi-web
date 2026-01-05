import { type RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import zodiacConstellationsUrl from "#src/assets/zodiac-constellations.jpg?url";
import { ApplicationController } from "#src/core/ApplicationController";
import type { DetectedPoint } from "#src/core/interfaces";
import { type DebugToneSample, setupDebugTools } from "#src/debug";
import { MediaPipePointDetector } from "#src/detection/mediapipe/MediaPipePointDetector";
import { bindHandsUi } from "#src/detection/mediapipe/uiHands";
import { HSVImageSampler } from "#src/sampling/hsv/HSVImageSampler";
import { OscillatorSonifier } from "#src/sonification/oscillator/OscillatorSonifier";
import { usePipelineStore } from "../state/pipelineStore";

type Refs = {
  videoRef: RefObject<HTMLVideoElement>;
  videoOverlayRef: RefObject<HTMLCanvasElement>;
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

const drawImageToCanvas = (canvas: HTMLCanvasElement, image: HTMLImageElement, cover: boolean) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const scale = cover
    ? Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
    : Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const offsetX = (canvas.width - drawWidth) / 2;
  const offsetY = (canvas.height - drawHeight) / 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  return true;
};

export const usePipeline = ({
  videoRef,
  videoOverlayRef,
  imageCanvasRef,
  imageOverlayRef,
}: Refs) => {
  const status = usePipelineStore((state) => state.status);
  const error = usePipelineStore((state) => state.error);
  const imageReady = usePipelineStore((state) => state.imageReady);
  const setStatus = usePipelineStore((state) => state.setStatus);
  const setImageReady = usePipelineStore((state) => state.setImageReady);
  const setHandDetected = usePipelineStore((state) => state.setHandDetected);
  const mirror = usePipelineStore((state) => state.mirror);
  const maxHands = usePipelineStore((state) => state.maxHands);
  const facingMode = usePipelineStore((state) => state.facingMode);
  const oscillator = usePipelineStore((state) => state.oscillator);
  const imageCover = usePipelineStore((state) => state.imageCover);

  const detectorRef = useRef<MediaPipePointDetector | null>(null);
  const samplerRef = useRef<HSVImageSampler | null>(null);
  const sonifierRef = useRef<OscillatorSonifier | null>(null);
  const controllerRef = useRef<ApplicationController | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const imageBufferRef = useRef<HTMLImageElement | null>(null);
  const debugToolsRef = useRef<ReturnType<typeof setupDebugTools> | null>(null);
  const handDetectedRef = useRef(false);

  const ensureCanvasesSized = useCallback(() => {
    if (videoOverlayRef.current) resizeCanvasToContainer(videoOverlayRef.current);
    if (imageCanvasRef.current) resizeCanvasToContainer(imageCanvasRef.current);
    if (imageOverlayRef.current) resizeCanvasToContainer(imageOverlayRef.current);
  }, [videoOverlayRef, imageCanvasRef, imageOverlayRef]);

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
      imageBufferRef.current = loaded;
      const canvas = imageCanvasRef.current;
      if (!canvas) {
        throw new Error("Image canvas missing for sampler load");
      }
      resizeCanvasToContainer(canvas);
      const cover = usePipelineStore.getState().imageCover;
      const drawn = drawImageToCanvas(canvas, loaded, cover);
      if (!drawn) {
        throw new Error("Unable to acquire 2D context for image canvas");
      }
      await samplerRef.current?.loadImage(canvas);
      setImageReady(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("herakoi-image-rendered"));
      }
    },
    [imageCanvasRef, setImageReady],
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
    if (!videoRef.current || !imageCanvasRef.current) {
      return;
    }
    try {
      setStatus("initializing");
      const snapshot = usePipelineStore.getState();
      samplerRef.current = new HSVImageSampler();
      sonifierRef.current = new OscillatorSonifier(undefined, {
        minFreq: snapshot.oscillator.minFreq,
        maxFreq: snapshot.oscillator.maxFreq,
        minVol: snapshot.oscillator.minVol,
        maxVol: snapshot.oscillator.maxVol,
        oscillatorType: snapshot.oscillator.oscillatorType,
      });
      detectorRef.current = new MediaPipePointDetector(videoRef.current, {
        maxHands: snapshot.maxHands,
        mirrorX: snapshot.mirror,
        facingMode: snapshot.facingMode,
        mediaPipeOptions: {
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
        },
      });

      if (videoOverlayRef.current && imageOverlayRef.current && detectorRef.current) {
        bindHandsUi(detectorRef.current, [videoOverlayRef.current, imageOverlayRef.current]);
      }

      controllerRef.current = new ApplicationController(
        detectorRef.current,
        samplerRef.current,
        sonifierRef.current,
      );

      handDetectedRef.current = false;
      setHandDetected(false);
      syncDebugPanel();

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

        const sampler = samplerRef.current;
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

      if (detectorRef.current) {
        detectorRef.current.onPointsDetected(logDebugSamples);
        detectorRef.current.onPointsDetected((points) => {
          const hasHands = points.length > 0;
          if (handDetectedRef.current === hasHands) return;
          handDetectedRef.current = hasHands;
          setHandDetected(hasHands);
        });
      }

      ensureCanvasesSized();
      if (imageBufferRef.current && imageCanvasRef.current) {
        const canvas = imageCanvasRef.current;
        const cover = usePipelineStore.getState().imageCover;
        const drawn = drawImageToCanvas(canvas, imageBufferRef.current, cover);
        if (!drawn) {
          throw new Error("Unable to acquire 2D context for image canvas");
        }
        await samplerRef.current?.loadImage(canvas);
        setImageReady(true);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("herakoi-image-rendered"));
        }
      } else {
        await loadImage(zodiacConstellationsUrl);
      }

      await controllerRef.current.start();
      analyserRef.current = sonifierRef.current.getAnalyserNode({
        fftSize: 2048,
        smoothingTimeConstant: 0.65,
      });
      setStatus("running");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error while starting pipeline";
      setStatus("error", message);
      console.error("Pipeline start failed:", error);
    }
  }, [
    ensureCanvasesSized,
    imageCanvasRef,
    loadImage,
    videoOverlayRef,
    imageOverlayRef,
    videoRef,
    setStatus,
    setImageReady,
    syncDebugPanel,
    setHandDetected,
  ]);

  const stop = useCallback(() => {
    controllerRef.current?.stop();
    setStatus("idle");
    handDetectedRef.current = false;
    setHandDetected(false);
  }, [setHandDetected, setStatus]);

  useEffect(() => {
    if (detectorRef.current) {
      detectorRef.current.setMirror(mirror);
    }
  }, [mirror]);

  useEffect(() => {
    if (detectorRef.current) {
      detectorRef.current.setMaxHands(maxHands);
    }
  }, [maxHands]);

  useEffect(() => {
    if (detectorRef.current) {
      void detectorRef.current.restartCamera(facingMode);
    }
  }, [facingMode]);

  useEffect(() => {
    if (sonifierRef.current) {
      sonifierRef.current.configure(oscillator);
    }
  }, [oscillator]);

  useEffect(() => {
    const handleResize = () => ensureCanvasesSized();
    const rerenderImage = () => {
      if (imageBufferRef.current && imageCanvasRef.current) {
        const canvas = imageCanvasRef.current;
        resizeCanvasToContainer(canvas);
        drawImageToCanvas(canvas, imageBufferRef.current, imageCover);
      }
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("resize", rerenderImage);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", rerenderImage);
    };
  }, [ensureCanvasesSized, imageCanvasRef, imageCover]);

  useEffect(() => {
    if (!imageBufferRef.current || !imageCanvasRef.current) return;
    const canvas = imageCanvasRef.current;
    resizeCanvasToContainer(canvas);
    const drawn = drawImageToCanvas(canvas, imageBufferRef.current, imageCover);
    if (drawn) {
      void samplerRef.current?.loadImage(canvas);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("herakoi-image-rendered"));
      }
    }
  }, [imageCover, imageCanvasRef]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    syncDebugPanel();
    const handleToggle = () => syncDebugPanel();
    window.addEventListener("herakoi-debug-toggle", handleToggle);
    return () => window.removeEventListener("herakoi-debug-toggle", handleToggle);
  }, [syncDebugPanel]);

  const surfaceRefs = useMemo(
    () => ({
      videoRef,
      videoOverlayRef,
      imageCanvasRef,
      imageOverlayRef,
    }),
    [videoRef, videoOverlayRef, imageCanvasRef, imageOverlayRef],
  );

  return {
    start,
    stop,
    surfaceRefs,
    status,
    error,
    imageReady,
    loadImageFile,
    loadImageSource,
    analyser: analyserRef,
  };
};
