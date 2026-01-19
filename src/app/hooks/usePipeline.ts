import { type RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import { ApplicationController } from "#src/core/ApplicationController";
import type { DetectedPoint } from "#src/core/interfaces";
import { type DebugToneSample, setupDebugTools } from "#src/debug";
import { MediaPipePointDetector } from "#src/detection/mediapipe/MediaPipePointDetector";
import type { HandOverlayStyle } from "#src/detection/mediapipe/overlay";
import { bindHandsUi } from "#src/detection/mediapipe/uiHands";
import { HSVImageSampler } from "#src/sampling/hsv/HSVImageSampler";
import { OscillatorSonifier } from "#src/sonification/oscillator/OscillatorSonifier";
import { curatedImages } from "../data/curatedImages";
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
  const setImagePan = usePipelineStore((state) => state.setImagePan);
  const setHandDetected = usePipelineStore((state) => state.setHandDetected);
  const mirror = usePipelineStore((state) => state.mirror);
  const maxHands = usePipelineStore((state) => state.maxHands);
  const facingMode = usePipelineStore((state) => state.facingMode);
  const oscillator = usePipelineStore((state) => state.oscillator);
  const imageCover = usePipelineStore((state) => state.imageCover);
  const imagePan = usePipelineStore((state) => state.imagePan);

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
      await samplerRef.current?.loadImage(canvas);
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
        const imageOverlayStyle: HandOverlayStyle = {
          connectorColor: "rgba(200, 200, 200, 0.85)",
          connectorWidth: 1.2,
          landmarkColor: "rgba(210, 210, 210, 0.95)",
          landmarkWidth: 1,
          focusColor: "rgba(215, 215, 215, 0.95)",
          focusFillColor: "rgba(210, 210, 210, 0.3)",
          focusWidth: 2,
          focusSize: 34,
          shadowColor: "rgba(210, 210, 210, 0.35)",
          shadowBlur: 8,
        };
        const getImageOverlayPointStyle = (point: DetectedPoint): HandOverlayStyle => {
          const sampler = samplerRef.current;
          const sample = sampler?.sampleAt(point);
          const hueByte = sample?.data?.hueByte;
          if (hueByte === undefined) {
            return imageOverlayStyle;
          }
          const hue = Math.round((hueByte / 255) * 360);
          const focusColor = `hsla(${hue}, 60%, 82%, 0.95)`;
          const focusFillColor = `hsla(${hue}, 55%, 55%, 0.38)`;
          const shadowColor = `hsla(${hue}, 60%, 70%, 0.6)`;
          return {
            ...imageOverlayStyle,
            focusColor,
            focusFillColor,
            shadowColor,
            shadowBlur: 10,
          };
        };
        bindHandsUi(detectorRef.current, [
          videoOverlayRef.current,
          {
            canvas: imageOverlayRef.current,
            style: imageOverlayStyle,
            getPointStyle: getImageOverlayPointStyle,
          },
        ]);
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
        const { imageCover: cover, imagePan: currentPan } = usePipelineStore.getState();
        const drawn = drawImageToCanvas(canvas, imageBufferRef.current, cover, currentPan);
        if (!drawn) {
          throw new Error("Unable to acquire 2D context for image canvas");
        }
        await samplerRef.current?.loadImage(canvas);
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

  useEffect(() => {
    if (!imageBufferRef.current || !imageCanvasRef.current) return;
    const canvas = imageCanvasRef.current;
    resizeCanvasToContainer(canvas);
    const drawn = drawImageToCanvas(canvas, imageBufferRef.current, imageCover, imagePan);
    if (drawn) {
      void samplerRef.current?.loadImage(canvas);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("herakoi-image-rendered"));
      }
    }
  }, [imageCover, imageCanvasRef, imagePan]);

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
