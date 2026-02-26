import { AsyncDisposableStack, isError } from "errore";
import { type RefObject, useCallback, useEffect, useRef } from "react";
import {
  EngineCanvasNotReadyError,
  SonificationFrameProcessingError,
} from "#src/core/domain-errors";
import type { ErrorOr } from "#src/core/interfaces";
import type {
  DetectorHandle,
  EngineConfig,
  SamplerHandle,
  SonifierHandle,
  VisualizerFrameData,
} from "#src/core/plugin";
import { mapDetectedPointsForSampling } from "#src/lib/canvas/sampling";
import { createAppConfigPluginRuntimeContext } from "#src/lib/engine/pluginRuntimeContext";
import {
  createEngineHandles,
  initializeEnginePlugins,
  resolveActiveEnginePlugins,
  startEngineDetection,
} from "#src/lib/engine/startup";
import {
  initializeAnalyserForVisualizer,
  updateSonificationDebugFrame,
} from "#src/lib/engine/visualizerFrame";
import { syncChain } from "#src/lib/syncChain";
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
  const startSessionIdRef = useRef(0);

  const visualizerFrameDataRef = useRef<VisualizerFrameData>({
    detection: { points: [], handDetected: false },
    sampling: { samples: new Map<string, { data: Record<string, number> }>() },
    sonification: { tones: new Map() },
    analyser: null,
  });

  const disposeActiveHandles = useCallback(() => {
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
  }, []);

  const start = useCallback(async (): Promise<SonificationEngineStartResult> => {
    const sessionId = ++startSessionIdRef.current;
    const isCurrentSession = () => startSessionIdRef.current === sessionId;
    const setStatusIfCurrent = (nextStatus: Parameters<typeof setStatus>[0]) => {
      if (!isCurrentSession()) return;
      setStatus(nextStatus);
    };

    // Ensure at most one active engine session (covers restart/start spam).
    disposeActiveHandles();

    if (!imageCanvasRef.current) {
      const error = new EngineCanvasNotReadyError();
      setStatusIfCurrent({ status: "error", error });
      console.error("Engine start failed:", error);
      return error;
    }
    setStatusIfCurrent({ status: "initializing" });

    // 1) Resolve active plugins.
    const { activePlugins, pluginConfigs } = useAppConfigStore.getState();
    const resolvedActivePlugins = resolveActiveEnginePlugins({
      config,
      activePlugins,
      pluginConfigs,
      createRuntimeContext: createAppConfigPluginRuntimeContext,
    });
    if (isError(resolvedActivePlugins)) {
      setStatusIfCurrent({ status: "error", error: resolvedActivePlugins });
      console.error("Engine start failed:", resolvedActivePlugins);
      return resolvedActivePlugins;
    }

    // 2) Create plugin handles.
    await using startupCleanup = new AsyncDisposableStack();
    const handlesResult = await createEngineHandles(resolvedActivePlugins);
    if (!isCurrentSession()) {
      return new Error("Engine start superseded by a newer session.");
    }
    if (isError(handlesResult)) {
      setStatusIfCurrent({ status: "error", error: handlesResult });
      console.error("Plugin creation failed:", handlesResult);
      return handlesResult;
    }

    const { detectorHandle: dh, samplerHandle: sh, sonifierHandle: soh } = handlesResult;
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

    // 3) Configure and initialize plugins.
    const initializeResult = await initializeEnginePlugins({
      detectorHandle: dh,
      samplerHandle: sh,
      sonifierHandle: soh,
      imageOverlayRef,
      imageCanvasRef,
    });
    if (!isCurrentSession()) {
      return new Error("Engine start superseded by a newer session.");
    }
    if (isError(initializeResult)) {
      setStatusIfCurrent({ status: "error", error: initializeResult });
      console.error("Engine initialization failed:", initializeResult);
      return initializeResult;
    }

    // 4) Register detection processing loop (promise pipeline).

    dh.detector.onPointsDetected((points) => {
      const frameResult = syncChain(points)
        .next((points) => {
          const hasDetectedPoints = points.length > 0;
          useAppRuntimeStore.getState().setHasDetectedPoints(hasDetectedPoints);
          visualizerFrameDataRef.current.detection = {
            points,
            handDetected: hasDetectedPoints,
          };
          return points;
        })
        .next((points) =>
          mapDetectedPointsForSampling({
            points,
            sourceSize: detectorHandleRef.current?.getSourceSize?.(),
            visibleRect: samplerHandleRef.current?.getVisibleRect?.(),
            canvasSize: {
              width: imageOverlayRef.current?.width ?? 0,
              height: imageOverlayRef.current?.height ?? 0,
            },
          }),
        )
        .next((mappedPoints) => sh.sampler.sampleAt(mappedPoints))
        .next((samplesResult) => {
          visualizerFrameDataRef.current.sampling = { samples: samplesResult };

          return samplesResult;
        })
        .next((samples) => soh.sonifier.processSamples(samples))
        .next((samples) => {
          updateSonificationDebugFrame({
            sonifierHandleRef,
            visualizerFrameDataRef,
          });
          return samples;
        })();

      if (!isError(frameResult)) return;
      console.error("Frame pipeline failed:", frameResult);
      disposeActiveHandles();
      setStatus({
        status: "error",
        error: new SonificationFrameProcessingError({ cause: frameResult }),
      });
    });

    // 5) Start detection and post-start setup.
    resizeCanvasRefToContainer(imageOverlayRef);
    const startResult = await startEngineDetection(dh);
    if (!isCurrentSession()) {
      return new Error("Engine start superseded by a newer session.");
    }
    if (isError(startResult)) {
      setStatusIfCurrent({ status: "error", error: startResult });
      console.error("Engine start failed:", startResult);
      return startResult;
    }

    initializeAnalyserForVisualizer({
      sonifierHandleRef,
      analyserRef,
      visualizerFrameDataRef,
      options: {
        fftSize: 2048,
        smoothingTimeConstant: 0.65,
      },
    });

    setStatusIfCurrent({ status: "running" });
    startupCleanup.move();
    return {
      status: "running",
      data: {
        detectionPluginId: resolvedActivePlugins.detection.id,
        samplingPluginId: resolvedActivePlugins.sampling.id,
        sonificationPluginId: resolvedActivePlugins.sonification.id,
      },
    };
  }, [config, disposeActiveHandles, imageCanvasRef, imageOverlayRef, setStatus]);

  const stop = useCallback(() => {
    // Invalidate any in-flight start() chain before disposing resources.
    startSessionIdRef.current += 1;
    disposeActiveHandles();
    setStatus({ status: "idle" });
  }, [disposeActiveHandles, setStatus]);

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
