import { type RefObject, useCallback, useEffect, useRef } from "react";
import type { ImageSample } from "#src/core/interfaces";
import type { PipelineConfig, PluginRuntimeContext, VisualizerFrameData } from "#src/core/plugin";
import { useAppConfigStore } from "../state/appConfigStore";
import { useAppRuntimeStore } from "../state/appRuntimeStore";
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

  const createPluginRuntimeContext = useCallback(
    (pluginId: string): PluginRuntimeContext<object> => {
      return {
        getConfig: () => useAppConfigStore.getState().pluginConfigs[pluginId] as object,
        setConfig: (updates) =>
          useAppConfigStore
            .getState()
            .setPluginConfig(pluginId, updates as Record<string, unknown>),
        subscribeConfig: (listener) =>
          useAppConfigStore.subscribe((state) => {
            listener(state.pluginConfigs[pluginId] as object);
          }),
      };
    },
    [],
  );

  const start = useCallback(async () => {
    if (!imageCanvasRef.current) {
      return;
    }
    try {
      setStatus({ status: "initializing" });

      // Resolve active plugins
      const {
        detection: activeDetectionId,
        sampling: activeSamplingId,
        sonification: activeSonificationId,
      } = useAppConfigStore.getState().activePlugins;
      const activeDetection = config.detection.find((p) => p.id === activeDetectionId);
      const activeSampling = config.sampling.find((p) => p.id === activeSamplingId);
      const activeSonification = config.sonification.find((p) => p.id === activeSonificationId);

      if (!activeDetection || !activeSampling || !activeSonification) {
        throw new Error(
          "Invalid active plugin configuration. Check engineConfig and active IDs in store.",
        );
      }

      // Create plugin instances
      // Get config from appConfigStore for detection plugin
      const detectionPluginId = activeDetection.id;
      const detectionConfig = useAppConfigStore.getState().pluginConfigs[detectionPluginId];
      const detectionRuntime = createPluginRuntimeContext(detectionPluginId);
      // Type assertion is safe: pluginId guarantees config type matches factory expectations
      const dh = activeDetection.createDetector(
        detectionConfig as never,
        detectionRuntime as never,
      );

      // Get config from appConfigStore for sampling plugin
      const samplingPluginId = activeSampling.id;
      const samplingConfig = useAppConfigStore.getState().pluginConfigs[samplingPluginId];
      const samplingRuntime = createPluginRuntimeContext(samplingPluginId);
      // Type assertion is safe: pluginId guarantees config type matches factory expectations
      const sh = activeSampling.createSampler(samplingConfig as never, samplingRuntime as never);

      // Get config from appConfigStore for sonification plugin
      const sonificationPluginId = activeSonification.id;
      const sonificationConfig = useAppConfigStore.getState().pluginConfigs[sonificationPluginId];
      const sonificationRuntime = createPluginRuntimeContext(sonificationPluginId);
      // Type assertion is safe: pluginId guarantees config type matches factory expectations
      const soh = activeSonification.createSonifier(
        sonificationConfig as never,
        sonificationRuntime as never,
      );

      detectorHandleRef.current = dh;
      samplerHandleRef.current = sh;
      sonifierHandleRef.current = soh;

      // Inject canvas refs to plugins (dependency injection)
      dh.setCanvasRefs?.({ imageOverlay: imageOverlayRef });
      sh.setCanvasRefs?.({ imageCanvas: imageCanvasRef });

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
        const sourceSize = detectorHandleRef.current?.getSourceSize?.();
        const visibleRect = samplerHandleRef.current?.getVisibleRect?.();
        const overlayCanvas = imageOverlayRef.current;
        const canvasW = overlayCanvas?.width ?? 0;
        const canvasH = overlayCanvas?.height ?? 0;

        for (const point of points) {
          let sx = point.x;
          let sy = point.y;

          if (
            sourceSize &&
            sourceSize.width > 0 &&
            sourceSize.height > 0 &&
            canvasW > 0 &&
            canvasH > 0
          ) {
            // Map video-space point to canvas-space using cover fit
            const scale = Math.max(canvasW / sourceSize.width, canvasH / sourceSize.height);
            const drawW = sourceSize.width * scale;
            const drawH = sourceSize.height * scale;
            const offsetX = (canvasW - drawW) / 2;
            const offsetY = (canvasH - drawH) / 2;
            sx = (offsetX + point.x * drawW) / canvasW;
            sy = (offsetY + point.y * drawH) / canvasH;
          }

          // Skip if outside the visible image rect
          if (visibleRect) {
            const px = sx * canvasW;
            const py = sy * canvasH;
            if (
              px < visibleRect.x ||
              px > visibleRect.x + visibleRect.width ||
              py < visibleRect.y ||
              py > visibleRect.y + visibleRect.height
            ) {
              continue;
            }
          }

          const sample = sh.sampler.sampleAt({ ...point, x: sx, y: sy });
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
      await dh.detector.start();

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
    ensureCanvasesSized,
    createPluginRuntimeContext,
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
