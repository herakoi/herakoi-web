import { isError } from "errore";
import {
  type MutableRefObject,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  DetectorHandle,
  SamplerHandle,
  SonifierHandle,
  VisualizerFrameData,
} from "#src/core/plugin";
import { mapDetectedPointsForSampling } from "#src/lib/canvas/sampling";
import { updateSonificationDebugFrame } from "#src/lib/engine/visualizerFrame";
import { syncChain } from "#src/lib/syncChain";
import { useAppRuntimeStore } from "#src/state/appRuntimeStore";

export type TransportStatus =
  | { status: "stopped" }
  | { status: "running" }
  | { status: "error"; error: Error };

export const useTransportLoop = (params: {
  imageOverlayRef: RefObject<HTMLCanvasElement>;
  visualizerFrameDataRef: MutableRefObject<VisualizerFrameData>;
  detectorHandle: DetectorHandle | null;
  samplerHandle: SamplerHandle | null;
  sonifierHandle: SonifierHandle | null;
}) => {
  const { imageOverlayRef, visualizerFrameDataRef, detectorHandle, samplerHandle, sonifierHandle } =
    params;
  const transportLoopAbortRef = useRef<AbortController | null>(null);
  const detectorHandleRef = useRef<DetectorHandle | null>(detectorHandle);
  const samplerHandleRef = useRef<SamplerHandle | null>(samplerHandle);
  const sonifierHandleRef = useRef<SonifierHandle | null>(sonifierHandle);
  const runningHandlesRef = useRef<{
    detectorHandle: DetectorHandle;
    samplerHandle: SamplerHandle;
    sonifierHandle: SonifierHandle;
  } | null>(null);
  const [transportStatus, setTransportStatus] = useState<TransportStatus>({ status: "stopped" });

  const flushState = useCallback(
    (sonifierHandle: SonifierHandle | null) => {
      const flushResult = sonifierHandle?.sonifier.processSamples(new Map());
      if (isError(flushResult)) {
        console.error("Failed to flush transport state:", flushResult);
      }
      useAppRuntimeStore.getState().setHasDetectedPoints(false);
      visualizerFrameDataRef.current.detection = {
        points: [],
        handDetected: false,
      };
      visualizerFrameDataRef.current.sampling = {
        samples: new Map(),
      };
      visualizerFrameDataRef.current.sonification = {
        tones: new Map(),
      };
    },
    [visualizerFrameDataRef],
  );

  const stopTransportLoop = useCallback(
    (options?: { flush?: boolean; sonifierHandle?: SonifierHandle | null }) => {
      transportLoopAbortRef.current?.abort();
      transportLoopAbortRef.current = null;
      runningHandlesRef.current = null;
      setTransportStatus({ status: "stopped" });
      if (options?.flush) {
        flushState(options.sonifierHandle ?? null);
      }
    },
    [flushState],
  );

  useEffect(() => {
    detectorHandleRef.current = detectorHandle;
    samplerHandleRef.current = samplerHandle;
    sonifierHandleRef.current = sonifierHandle;
  }, [detectorHandle, samplerHandle, sonifierHandle]);

  const startTransportLoop = useCallback(
    (overrides?: {
      detectorHandle?: DetectorHandle | null;
      samplerHandle?: SamplerHandle | null;
      sonifierHandle?: SonifierHandle | null;
    }) => {
      const activeDetector = overrides?.detectorHandle ?? detectorHandleRef.current;
      const activeSampler = overrides?.samplerHandle ?? samplerHandleRef.current;
      const activeSonifier = overrides?.sonifierHandle ?? sonifierHandleRef.current;
      if (!activeDetector || !activeSampler || !activeSonifier) {
        return;
      }
      if (transportLoopAbortRef.current) return;

      const abortController = new AbortController();
      transportLoopAbortRef.current = abortController;
      setTransportStatus({ status: "running" });
      runningHandlesRef.current = {
        detectorHandle: activeDetector,
        samplerHandle: activeSampler,
        sonifierHandle: activeSonifier,
      };

      void (async () => {
        let failed = false;
        try {
          for await (const points of activeDetector.detector.points(abortController.signal)) {
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
                  sourceSize: activeDetector.getSourceSize?.(),
                  visibleRect: activeSampler.getVisibleRect?.(),
                  canvasSize: {
                    width: imageOverlayRef.current?.width ?? 0,
                    height: imageOverlayRef.current?.height ?? 0,
                  },
                }),
              )
              .next((mappedPoints) => activeSampler.sampler.sampleAt(mappedPoints))
              .next((samplesResult) => {
                visualizerFrameDataRef.current.sampling = { samples: samplesResult };
                return samplesResult;
              })
              .next((samples) => activeSonifier.sonifier.processSamples(samples))
              .next((samples) => {
                updateSonificationDebugFrame({
                  sonifierHandleRef: { current: activeSonifier },
                  visualizerFrameDataRef,
                });
                return samples;
              })();

            if (!isError(frameResult)) continue;
            console.error("Frame pipeline failed:", frameResult);
            failed = true;
            stopTransportLoop();
            setTransportStatus({ status: "error", error: frameResult });
            return;
          }
        } catch (error) {
          if (abortController.signal.aborted) return;
          const frameError = error instanceof Error ? error : new Error("Point stream failed.");
          console.error("Point stream failed:", frameError);
          failed = true;
          stopTransportLoop();
          setTransportStatus({ status: "error", error: frameError });
        } finally {
          if (transportLoopAbortRef.current === abortController) {
            transportLoopAbortRef.current = null;
            if (!failed) {
              setTransportStatus({ status: "stopped" });
            }
          }
        }
      })();
    },
    [imageOverlayRef, stopTransportLoop, visualizerFrameDataRef],
  );

  useEffect(() => {
    const runningHandles = runningHandlesRef.current;
    if (!runningHandles) return;
    if (
      runningHandles.detectorHandle !== detectorHandle ||
      runningHandles.samplerHandle !== samplerHandle ||
      runningHandles.sonifierHandle !== sonifierHandle
    ) {
      stopTransportLoop({
        flush: true,
        sonifierHandle: runningHandles.sonifierHandle,
      });
    }
  }, [detectorHandle, samplerHandle, sonifierHandle, stopTransportLoop]);

  useEffect(() => {
    return () => {
      stopTransportLoop();
    };
  }, [stopTransportLoop]);

  return {
    startTransportLoop,
    stopTransportLoop,
    transportStatus,
  };
};
