import { type RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import zodiacConstellationsUrl from "#src/assets/zodiac-constellations.jpg?url";
import { ApplicationController } from "#src/core/ApplicationController";
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
  const mirror = usePipelineStore((state) => state.mirror);
  const maxHands = usePipelineStore((state) => state.maxHands);
  const facingMode = usePipelineStore((state) => state.facingMode);
  const oscillator = usePipelineStore((state) => state.oscillator);

  const detectorRef = useRef<MediaPipePointDetector | null>(null);
  const samplerRef = useRef<HSVImageSampler | null>(null);
  const sonifierRef = useRef<OscillatorSonifier | null>(null);
  const controllerRef = useRef<ApplicationController | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const imageBufferRef = useRef<HTMLImageElement | null>(null);

  const ensureCanvasesSized = useCallback(() => {
    if (videoOverlayRef.current) resizeCanvasToContainer(videoOverlayRef.current);
    if (imageCanvasRef.current) resizeCanvasToContainer(imageCanvasRef.current);
    if (imageOverlayRef.current) resizeCanvasToContainer(imageOverlayRef.current);
  }, [videoOverlayRef, imageCanvasRef, imageOverlayRef]);

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
      canvas.width = loaded.naturalWidth;
      canvas.height = loaded.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Unable to acquire 2D context for image canvas");
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const aspectImage = loaded.naturalWidth / loaded.naturalHeight || 1;
      const aspectCanvas = canvas.width / canvas.height || 1;
      let drawWidth = canvas.width;
      let drawHeight = canvas.height;
      let offsetX = 0;
      let offsetY = 0;
      if (aspectImage > aspectCanvas) {
        drawWidth = canvas.width;
        drawHeight = canvas.width / aspectImage;
        offsetY = (canvas.height - drawHeight) / 2;
      } else {
        drawHeight = canvas.height;
        drawWidth = canvas.height * aspectImage;
        offsetX = (canvas.width - drawWidth) / 2;
      }
      ctx.drawImage(loaded, offsetX, offsetY, drawWidth, drawHeight);
      await samplerRef.current?.loadImage(canvas);
      setImageReady(true);
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

      ensureCanvasesSized();
      await loadImage(zodiacConstellationsUrl);

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
  ]);

  const stop = useCallback(() => {
    controllerRef.current?.stop();
    setStatus("idle");
  }, [setStatus]);

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
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const loaded = imageBufferRef.current;
        const aspectImage = loaded.naturalWidth / loaded.naturalHeight || 1;
        const aspectCanvas = canvas.width / canvas.height || 1;
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        let offsetX = 0;
        let offsetY = 0;
        if (aspectImage > aspectCanvas) {
          drawWidth = canvas.width;
          drawHeight = canvas.width / aspectImage;
          offsetY = (canvas.height - drawHeight) / 2;
        } else {
          drawHeight = canvas.height;
          drawWidth = canvas.height * aspectImage;
          offsetX = (canvas.width - drawWidth) / 2;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(loaded, offsetX, offsetY, drawWidth, drawHeight);
      }
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("resize", rerenderImage);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", rerenderImage);
    };
  }, [ensureCanvasesSized, imageCanvasRef]);

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
    analyser: analyserRef,
  };
};
