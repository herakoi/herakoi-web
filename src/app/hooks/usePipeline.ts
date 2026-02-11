import { type RefObject, useCallback, useEffect, useRef } from "react";
import { ApplicationController } from "#src/core/ApplicationController";
import type { PipelineConfig } from "#src/core/plugin";
import { type DebugToneSample, setupDebugTools } from "#src/debug";
import { registerOverlayRef } from "#src/detection/mediapipe/refs";
import { registerImageCanvasRef } from "#src/sampling/hsv/refs";
import { useHSVSamplingStore } from "#src/sampling/hsv/store";
import type { DebugFrameSample } from "#src/sonification/oscillator/OscillatorSonifier";
import { useNotificationStore } from "../state/notificationStore";
import { usePipelineStore } from "../state/pipelineStore";

const resizeCanvasToContainer = (canvas: HTMLCanvasElement) => {
  const parent = canvas.parentElement;
  const rect = parent?.getBoundingClientRect();
  const width = Math.round(rect?.width ?? canvas.clientWidth ?? 640);
  const height = Math.round(rect?.height ?? canvas.clientHeight ?? Math.round(width * 0.75)) || 480;
  canvas.width = width;
  canvas.height = height;
};

type Refs = {
  imageCanvasRef: RefObject<HTMLCanvasElement>;
  imageOverlayRef: RefObject<HTMLCanvasElement>;
};

export const usePipeline = (config: PipelineConfig, { imageCanvasRef, imageOverlayRef }: Refs) => {
  const status = usePipelineStore((state) => state.status);
  const error = usePipelineStore((state) => state.error);
  const setStatus = usePipelineStore((state) => state.setStatus);
  const activeDetectionId = usePipelineStore((state) => state.activeDetectionId);
  const activeSamplingId = usePipelineStore((state) => state.activeSamplingId);
  const activeSonificationId = usePipelineStore((state) => state.activeSonificationId);

  const imageReady = useHSVSamplingStore((state) => state.imageReady);

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
  const samplerExtrasRef = useRef<Record<string, unknown> | null>(null);
  const controllerRef = useRef<ApplicationController | null>(null);
  const debugToolsRef = useRef<ReturnType<typeof setupDebugTools> | null>(null);

  const ensureCanvasesSized = useCallback(() => {
    if (imageOverlayRef.current) resizeCanvasToContainer(imageOverlayRef.current);
  }, [imageOverlayRef]);

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

      // Register refs for plugins
      if (imageOverlayRef.current) {
        registerOverlayRef("imageOverlay", imageOverlayRef);
      }
      registerImageCanvasRef(imageCanvasRef);

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

      // Run sampling plugin post-initialize (loads image, draws to canvas, encodes HSV)
      await sh.postInitialize?.();
      samplerExtrasRef.current = sh.extras ?? null;

      // Create and start controller
      const controller = new ApplicationController(dh.detector, sh.sampler, soh.sonifier);
      controllerRef.current = controller;
      syncDebugPanel();

      // Debug logging — reads pre-computed data from the sonifier
      const logDebugSamples = () => {
        const debugEnabled = new URLSearchParams(window.location.search).has("dev");
        if (!debugEnabled) return;

        if (!debugToolsRef.current) {
          debugToolsRef.current = setupDebugTools();
        }

        const debugTools = debugToolsRef.current;
        if (!debugTools) return;

        const getLastFrameDebug = sonifierHandleRef.current?.extras?.getLastFrameDebug as
          | (() => Map<string, DebugFrameSample>)
          | undefined;

        if (!getLastFrameDebug) {
          debugTools.logToneSamples([]);
          return;
        }

        const frameDebug = getLastFrameDebug();
        const debugToneSamples: DebugToneSample[] = [];
        for (const [toneId, data] of frameDebug) {
          debugToneSamples.push({ toneId, ...data });
        }

        debugTools.logToneSamples(debugToneSamples);
      };

      dh.detector.onPointsDetected(logDebugSamples);

      ensureCanvasesSized();

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
    setStatus,
    syncDebugPanel,
  ]);

  const stop = useCallback(() => {
    controllerRef.current?.stop();
    detectorHandleRef.current?.cleanup?.();
    samplerHandleRef.current?.cleanup?.();
    sonifierHandleRef.current?.cleanup?.();
    analyserRef.current = null;
    samplerExtrasRef.current = null;
    useNotificationStore.getState().clearAll();
    usePipelineStore.getState().setUiOpacity(1);
    setStatus("idle");
  }, [setStatus]);

  // Window resize handler (overlay canvas only — image canvas is handled by sampling plugin)
  useEffect(() => {
    const handleResize = () => ensureCanvasesSized();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [ensureCanvasesSized]);

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
    // Expose analyser access for visualizations
    analyser: analyserRef,
    // Expose sampler extras (e.g., regionLuminance) for header tone sampling
    samplerExtras: samplerExtrasRef,
  };
};
