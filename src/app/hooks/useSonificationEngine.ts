import { type RefObject, useCallback, useEffect, useRef } from "react";
import type { AppPluginConfigRegistry } from "#src/app/pluginConfigRegistry";
import type { ImageSample } from "#src/core/interfaces";
import type { PipelineConfig, VisualizerFrameData } from "#src/core/plugin";
import { useActivePlugin, useAppConfigStore } from "../state/appConfigStore";
import { useAppRuntimeStore } from "../state/appRuntimeStore";
import { useNotificationStore } from "../state/notificationStore";
import { resizeCanvasToContainer } from "./ui/canvas";

type Refs = {
  imageCanvasRef: RefObject<HTMLCanvasElement>;
  imageOverlayRef: RefObject<HTMLCanvasElement>;
};

export const useSonificationEngine = (
  config: PipelineConfig,
  { imageCanvasRef, imageOverlayRef }: Refs,
) => {
  const status = useAppRuntimeStore((state) => state.pipelineStatus);
  const setStatus = useAppRuntimeStore((state) => state.setStatus);
  const [activeDetectionId] = useActivePlugin("detection");
  const [activeSamplingId] = useActivePlugin("sampling");
  const [activeSonificationId] = useActivePlugin("sonification");

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

  const visualizerFrameDataRef = useRef<VisualizerFrameData>({
    detection: { points: [], handDetected: false },
    sampling: { samples: new Map<string, { data: Record<string, number> }>() },
    sonification: { tones: new Map() },
    analyser: null,
  });

  const ensureCanvasesSized = useCallback(() => {
    if (imageOverlayRef.current) resizeCanvasToContainer(imageOverlayRef.current);
  }, [imageOverlayRef]);

  const start = useCallback(async () => {
    if (!imageCanvasRef.current) {
      return;
    }
    try {
      setStatus({ status: "initializing" });

      // Resolve active plugins
      const activeDetection = config.detection.find((p) => p.id === activeDetectionId);
      const activeSampling = config.sampling.find((p) => p.id === activeSamplingId);
      const activeSonification = config.sonification.find((p) => p.id === activeSonificationId);

      if (!activeDetection || !activeSampling || !activeSonification) {
        throw new Error(
          "Invalid active plugin configuration. Check pipelineConfig and active IDs in store.",
        );
      }

      // Create plugin instances
      // Get config from appConfigStore for detection plugin
      const detectionPluginId = activeDetection.id as keyof AppPluginConfigRegistry;
      const detectionConfig = useAppConfigStore.getState().pluginConfigs[detectionPluginId];
      // Type assertion is safe: pluginId guarantees config type matches factory expectations
      const dh = activeDetection.createDetector(detectionConfig as never);

      // Get config from appConfigStore for sampling plugin
      const samplingPluginId = activeSampling.id as keyof AppPluginConfigRegistry;
      const samplingConfig = useAppConfigStore.getState().pluginConfigs[samplingPluginId];
      // Type assertion is safe: pluginId guarantees config type matches factory expectations
      const sh = activeSampling.createSampler(samplingConfig as never);

      // Get config from appConfigStore for sonification plugin
      const sonificationPluginId = activeSonification.id as keyof AppPluginConfigRegistry;
      const sonificationConfig = useAppConfigStore.getState().pluginConfigs[sonificationPluginId];
      // Type assertion is safe: pluginId guarantees config type matches factory expectations
      const soh = activeSonification.createSonifier(sonificationConfig as never);

      detectorHandleRef.current = dh;
      samplerHandleRef.current = sh;
      sonifierHandleRef.current = soh;

      // Inject canvas refs to plugins (dependency injection)
      dh.setCanvasRefs?.({ imageOverlay: imageOverlayRef });
      sh.setCanvasRefs?.({ imageCanvas: imageCanvasRef });

      // Wire up pipeline events
      activeDetection.bindPipelineEvents(dh.detector, {
        showNotification: useNotificationStore.getState().show,
        hideNotification: useNotificationStore.getState().hide,
      });

      // Run sampling plugin post-initialize (loads image, draws to canvas, encodes HSV)
      await sh.postInitialize?.();

      // Initialize detector and sonifier (inlined from ApplicationController)
      await dh.detector.initialize();
      await soh.sonifier.initialize();

      // Register detection callback that orchestrates the sonification loop
      dh.detector.onPointsDetected((points) => {
        // Update detection data for visualizers
        visualizerFrameDataRef.current.detection = {
          points,
          handDetected: points.length > 0,
        };

        // Update shell runtime state for idle dimming
        useAppRuntimeStore.getState().setHasDetectedPoints(points.length > 0);

        const samples = new Map<string, ImageSample>();

        for (const point of points) {
          const sample = sh.sampler.sampleAt(point);
          if (sample) {
            samples.set(point.id, sample);
          }
        }

        // Update sampling data for visualizers
        visualizerFrameDataRef.current.sampling = { samples };

        soh.sonifier.processSamples(samples);

        // Update sonification data for visualizers
        type FrameDebugData = {
          frequency: number;
          volume: number;
          hueByte: number;
          saturationByte: number;
          valueByte: number;
        };

        const getLastFrameDebug = sonifierHandleRef.current?.extras?.getLastFrameDebug as
          | (() => Map<string, FrameDebugData>)
          | undefined;

        if (getLastFrameDebug) {
          const frameDebug = getLastFrameDebug();
          visualizerFrameDataRef.current.sonification = { tones: frameDebug };
        }
      });

      ensureCanvasesSized();

      // Start detection (inlined from ApplicationController)
      dh.detector.start();

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

        // Update visualizer frame data with analyser
        visualizerFrameDataRef.current.analyser = analyserRef.current;
      }

      setStatus({ status: "running" });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error while starting pipeline";
      setStatus({ status: "error", errorMessage });
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
  ]);

  const stop = useCallback(() => {
    // Stop detection and sonification (inlined from ApplicationController)
    detectorHandleRef.current?.detector.stop();
    sonifierHandleRef.current?.sonifier.stop();

    // Run plugin cleanup hooks
    detectorHandleRef.current?.cleanup?.();
    samplerHandleRef.current?.cleanup?.();
    sonifierHandleRef.current?.cleanup?.();

    analyserRef.current = null;
    useNotificationStore.getState().clearAll();
    useAppRuntimeStore.getState().setCurrentUiOpacity(1);
    useAppRuntimeStore.getState().setHasDetectedPoints(false);
    setStatus({ status: "idle" });
  }, [setStatus]);

  // Window resize handler (overlay canvas only — image canvas is handled by sampling plugin)
  useEffect(() => {
    const handleResize = () => ensureCanvasesSized();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [ensureCanvasesSized]);

  return {
    start,
    stop,
    status,
    // Expose analyser access for visualizations
    analyser: analyserRef,
    // Expose visualizer frame data for visualization plugins
    visualizerFrameDataRef,
  };
};
