import { type RefObject, useCallback, useEffect, useRef } from "react";
import type { ErrorOr } from "#src/core/interfaces";
import type { EngineConfig, VisualizerFrameData } from "#src/core/plugin";
import { useEngineHandles } from "./engine/useEngineHandles";
import { useTransportLoop } from "./engine/useTransportLoop";
import { resizeCanvasRefToContainer } from "./ui/canvas";

type Refs = {
  imageCanvasRef: RefObject<HTMLCanvasElement>;
  imageOverlayRef: RefObject<HTMLCanvasElement>;
};

export type SonificationEngineStartResult = ErrorOr<{
  status: "running";
}>;

export const useSonificationEngine = (
  config: EngineConfig,
  { imageCanvasRef, imageOverlayRef }: Refs,
) => {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const visualizerFrameDataRef = useRef<VisualizerFrameData>({
    detection: { points: [], handDetected: false },
    sampling: { samples: new Map<string, { data: Record<string, number> }>() },
    sonification: { tones: new Map() },
    analyser: null,
  });

  const {
    handles,
    status: engineStatus,
    restartEngine: restartEngineHandles,
  } = useEngineHandles({
    config,
    refs: { imageCanvasRef, imageOverlayRef },
    analyserRef,
    visualizerFrameDataRef,
  });

  const { startTransportLoop, stopTransportLoop, transportStatus } = useTransportLoop({
    imageOverlayRef,
    visualizerFrameDataRef,
    detectorHandle: handles?.detectorHandle ?? null,
    samplerHandle: handles?.samplerHandle ?? null,
    sonifierHandle: handles?.sonifierHandle ?? null,
  });

  const startTransport = useCallback(async (): Promise<SonificationEngineStartResult> => {
    if (engineStatus !== "ready" || !handles) {
      return new Error("Engine is not ready.");
    }
    startTransportLoop(handles);
    return {
      status: "running",
    };
  }, [engineStatus, handles, startTransportLoop]);

  const stopTransport = useCallback(() => {
    stopTransportLoop({
      flush: true,
      sonifierHandle: handles?.sonifierHandle ?? null,
    });
  }, [handles?.sonifierHandle, stopTransportLoop]);

  const restartEngine = useCallback(() => {
    stopTransportLoop({
      flush: true,
      sonifierHandle: handles?.sonifierHandle ?? null,
    });
    restartEngineHandles();
  }, [handles?.sonifierHandle, restartEngineHandles, stopTransportLoop]);

  useEffect(() => {
    const handleResize = () => resizeCanvasRefToContainer(imageOverlayRef);
    // visibilitychange covers mobile tab resume where no resize event is fired.
    const handleVisibilityChange = () => {
      if (!document.hidden) resizeCanvasRefToContainer(imageOverlayRef);
    };
    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [imageOverlayRef]);

  return {
    startTransport,
    stopTransport,
    restartEngine,
    engineStatus,
    transportStatus,
    analyser: analyserRef,
    visualizerFrameDataRef,
  };
};
