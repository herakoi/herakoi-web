import { AsyncDisposableStack, isError, tryAsync } from "errore";
import { type RefObject, useCallback, useEffect, useRef } from "react";
import {
  DetectionInitializeError,
  DetectionPostInitializeError,
  DetectionStartError,
  EngineCanvasNotReadyError,
  InvalidPluginConfigurationError,
  PluginCreationError,
  SamplingPostInitializeError,
  SonificationFrameProcessingError,
  SonifierInitializeError,
} from "#src/core/domain-errors";
import type { ErrorOr } from "#src/core/interfaces";
import type {
  DetectorHandle,
  EngineConfig,
  SamplerHandle,
  SonifierHandle,
  VisualizerFrameData,
} from "#src/core/plugin";
import { buildSamplesForDetectedPoints } from "#src/lib/canvas/sampling";
import { createAppConfigPluginRuntimeContext } from "#src/lib/engine/pluginRuntimeContext";
import { safelyCreatePluginHandle } from "#src/lib/engine/runtime";
import { updateSonificationDebugFrame } from "#src/lib/engine/visualizerFrame";
import { useAppConfigStore } from "../state/appConfigStore";
import { useAppRuntimeStore } from "../state/appRuntimeStore";
import { resizeCanvasRefToContainer } from "./ui/canvas";

type Refs = {
  imageCanvasRef: RefObject<HTMLCanvasElement>;
  imageOverlayRef: RefObject<HTMLCanvasElement>;
};

type EngineStartData = {
  detectionPluginId: string;
  samplingPluginId: string;
  sonificationPluginId: string;
};

export type SonificationEngineStartResult = ErrorOr<{
  status: "running";
  data: EngineStartData;
}>;

export const useSonificationEngine = (
  config: EngineConfig,
  { imageCanvasRef, imageOverlayRef }: Refs,
) => {
  const status = useAppRuntimeStore((state) => state.engineStatus);
  const setStatus = useAppRuntimeStore((state) => state.setStatus);

  const detectorHandleRef = useRef<DetectorHandle | null>(null);
  const samplerHandleRef = useRef<SamplerHandle | null>(null);
  const sonifierHandleRef = useRef<SonifierHandle | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const visualizerFrameDataRef = useRef<VisualizerFrameData>({
    detection: { points: [], handDetected: false },
    sampling: { samples: new Map<string, { data: Record<string, number> }>() },
    sonification: { tones: new Map() },
    analyser: null,
  });

  const start = useCallback(async (): Promise<SonificationEngineStartResult> => {
    if (!imageCanvasRef.current) {
      const error = new EngineCanvasNotReadyError();
      setStatus({ status: "error", error });
      console.error("Engine start failed:", error);
      return error;
    }
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
      const error = new InvalidPluginConfigurationError();
      setStatus({ status: "error", error });
      console.error("Engine start failed:", error);
      return error;
    }

    const detectionPluginId = activeDetection.id;
    const detectionConfig = useAppConfigStore.getState().pluginConfigs[detectionPluginId];
    const detectionRuntime = createAppConfigPluginRuntimeContext(detectionPluginId);

    const samplingPluginId = activeSampling.id;
    const samplingConfig = useAppConfigStore.getState().pluginConfigs[samplingPluginId];
    const samplingRuntime = createAppConfigPluginRuntimeContext(samplingPluginId);

    const sonificationPluginId = activeSonification.id;
    const sonificationConfig = useAppConfigStore.getState().pluginConfigs[sonificationPluginId];
    const sonificationRuntime = createAppConfigPluginRuntimeContext(sonificationPluginId);

    await using startupCleanup = new AsyncDisposableStack();
    const [detectionHandleResult, samplingHandleResult, sonificationHandleResult] =
      await Promise.all([
        safelyCreatePluginHandle(() =>
          activeDetection.createDetector(detectionConfig as never, detectionRuntime as never),
        ),
        safelyCreatePluginHandle(() =>
          activeSampling.createSampler(samplingConfig as never, samplingRuntime as never),
        ),
        safelyCreatePluginHandle(() =>
          activeSonification.createSonifier(
            sonificationConfig as never,
            sonificationRuntime as never,
          ),
        ),
      ]);

    if (isError(detectionHandleResult)) {
      const error = new PluginCreationError({ cause: detectionHandleResult });
      setStatus({ status: "error", error });
      console.error("Detection plugin creation failed:", error);
      return error;
    }
    if (isError(samplingHandleResult)) {
      const error = new PluginCreationError({ cause: samplingHandleResult });
      setStatus({ status: "error", error });
      console.error("Sampling plugin creation failed:", error);
      return error;
    }
    if (isError(sonificationHandleResult)) {
      const error = new PluginCreationError({ cause: sonificationHandleResult });
      setStatus({ status: "error", error });
      console.error("Sonification plugin creation failed:", error);
      return error;
    }

    const dh = detectionHandleResult;
    const sh = samplingHandleResult;
    const soh = sonificationHandleResult;

    detectorHandleRef.current = dh;
    samplerHandleRef.current = sh;
    sonifierHandleRef.current = soh;
    startupCleanup.use(dh);
    startupCleanup.use(sh);
    startupCleanup.use(soh);
    startupCleanup.defer(() => {
      if (detectorHandleRef.current === dh) detectorHandleRef.current = null;
      if (samplerHandleRef.current === sh) samplerHandleRef.current = null;
      if (sonifierHandleRef.current === soh) sonifierHandleRef.current = null;
      analyserRef.current = null;
      useAppRuntimeStore.getState().setHasDetectedPoints(false);
    });

    // Inject canvas refs to plugins (dependency injection)
    dh.setCanvasRefs?.({ imageOverlay: imageOverlayRef });
    sh.setCanvasRefs?.({ imageCanvas: imageCanvasRef });

    const postInitializeResult = await tryAsync({
      try: async () => sh.postInitialize?.(),
      catch: (error) => new SamplingPostInitializeError({ cause: error }),
    });
    if (isError(postInitializeResult)) {
      setStatus({ status: "error", error: postInitializeResult });
      console.error("Engine start failed:", postInitializeResult);
      return postInitializeResult;
    }

    // Initialize detector and sonifier
    const detectorInitError = await dh.detector.initialize();
    if (isError(detectorInitError)) {
      const error = new DetectionInitializeError({ cause: detectorInitError });
      setStatus({ status: "error", error });
      console.error("Detector initialization failed:", error);
      return error;
    }

    const sonifierInitError = await soh.sonifier.initialize();
    if (isError(sonifierInitError)) {
      const error = new SonifierInitializeError({ cause: sonifierInitError });
      setStatus({ status: "error", error });
      console.error("Sonifier initialization failed:", error);
      return error;
    }

    // Register detection callback that orchestrates the sonification loop
    dh.detector.onPointsDetected((points) => {
      // Update detection data for visualizers
      visualizerFrameDataRef.current.detection = {
        points,
        handDetected: points.length > 0,
      };

      // Update shell runtime state for idle dimming
      useAppRuntimeStore.getState().setHasDetectedPoints(points.length > 0);

      const sourceSize = detectorHandleRef.current?.getSourceSize?.();
      const visibleRect = samplerHandleRef.current?.getVisibleRect?.();
      const overlayCanvas = imageOverlayRef.current;
      const canvasSize = {
        width: overlayCanvas?.width ?? 0,
        height: overlayCanvas?.height ?? 0,
      };
      const samples = buildSamplesForDetectedPoints({
        points,
        sourceSize,
        visibleRect,
        canvasSize,
        sampleAt: (point) => sh.sampler.sampleAt(point),
        onSampleError: (error) => {
          console.error("Sampling failed for point:", error);
        },
      });

      // Update sampling data for visualizers
      visualizerFrameDataRef.current.sampling = { samples };

      const sonifierError = soh.sonifier.processSamples(samples);
      if (isError(sonifierError)) {
        setStatus({
          status: "error",
          error: new SonificationFrameProcessingError({ cause: sonifierError }),
        });
        console.error("Sonification frame failed:", sonifierError);
        return;
      }

      // Update sonification data for visualizers
      updateSonificationDebugFrame({
        sonifierHandleRef,
        visualizerFrameDataRef,
      });
    });

    resizeCanvasRefToContainer(imageOverlayRef);

    // Start detection
    const detectorStartError = await dh.detector.start();
    if (isError(detectorStartError)) {
      const error = new DetectionStartError({ cause: detectorStartError });
      setStatus({ status: "error", error });
      console.error("Detector start failed:", error);
      return error;
    }

    const postStartResult = await tryAsync({
      try: async () => dh.postInitialize?.(),
      catch: (error) => new DetectionPostInitializeError({ cause: error }),
    });
    if (isError(postStartResult)) {
      setStatus({ status: "error", error: postStartResult });
      console.error("Detector post-initialize failed:", postStartResult);
      return postStartResult;
    }

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
    // Transfer ownership so `await using` does not rollback on successful start.
    startupCleanup.move();
    return {
      status: "running",
      data: {
        detectionPluginId: activeDetection.id,
        samplingPluginId: activeSampling.id,
        sonificationPluginId: activeSonification.id,
      },
    };
  }, [config, imageCanvasRef, imageOverlayRef, setStatus]);

  const stop = useCallback(() => {
    // Handles own their cleanup/stop via Symbol.dispose.
    detectorHandleRef.current?.[Symbol.dispose]();
    samplerHandleRef.current?.[Symbol.dispose]();
    sonifierHandleRef.current?.[Symbol.dispose]();
    detectorHandleRef.current = null;
    samplerHandleRef.current = null;
    sonifierHandleRef.current = null;

    analyserRef.current = null;
    useAppRuntimeStore.getState().setCurrentUiOpacity(1);
    useAppRuntimeStore.getState().setHasDetectedPoints(false);
    setStatus({ status: "idle" });
  }, [setStatus]);

  // Window resize handler (overlay canvas only — image canvas is handled by sampling plugin)
  useEffect(() => {
    const handleResize = () => resizeCanvasRefToContainer(imageOverlayRef);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [imageOverlayRef]);

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
