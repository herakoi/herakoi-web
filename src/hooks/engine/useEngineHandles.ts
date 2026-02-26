import { isError } from "errore";
import {
  type MutableRefObject,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { EngineConfig, VisualizerFrameData } from "#src/core/plugin";
import { initializeAnalyserForVisualizer } from "#src/lib/engine/visualizerFrame";
import { useAppConfigStore } from "#src/state/appConfigStore";
import { useAppRuntimeStore } from "#src/state/appRuntimeStore";
import { resizeCanvasRefToContainer } from "../ui/canvas";
import type {
  ActiveEnginePluginIds,
  EngineHandles,
  EngineHandlesStatus,
  EngineSnapshot,
} from "./engineHandles.types";
import { runEngineInitTransaction } from "./engineInitTransaction";

type Refs = {
  imageCanvasRef: RefObject<HTMLCanvasElement>;
  imageOverlayRef: RefObject<HTMLCanvasElement>;
};

export type { EngineHandles, EngineHandlesStatus } from "./engineHandles.types";

export const useEngineHandles = (params: {
  config: EngineConfig;
  refs: Refs;
  analyserRef: MutableRefObject<AnalyserNode | null>;
  visualizerFrameDataRef: MutableRefObject<VisualizerFrameData>;
}) => {
  const { config, refs, analyserRef, visualizerFrameDataRef } = params;
  const { imageCanvasRef, imageOverlayRef } = refs;
  const activeDetectionPluginId = useAppConfigStore((state) => state.activePlugins.detection);
  const activeSamplingPluginId = useAppConfigStore((state) => state.activePlugins.sampling);
  const activeSonificationPluginId = useAppConfigStore((state) => state.activePlugins.sonification);

  const snapshotRef = useRef<EngineSnapshot>({
    ids: null,
    handles: null,
  });
  const inFlightRef = useRef(false);
  const pendingSelectionRef = useRef<{
    detection: string;
    sampling: string;
    sonification: string;
  } | null>(null);
  const initAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const [handles, setHandles] = useState<EngineHandles | null>(null);
  const [status, setStatus] = useState<EngineHandlesStatus>("initializing");
  const commitEngineSnapshotRef = useRef<
    ((nextSnapshot: { ids: ActiveEnginePluginIds; handles: EngineHandles }) => void) | null
  >(null);
  const disposeEngineRef = useRef<(() => void) | null>(null);

  const disposeHandles = (targetHandles: EngineHandles | null) => {
    targetHandles?.detectorHandle[Symbol.dispose]();
    targetHandles?.samplerHandle[Symbol.dispose]();
    targetHandles?.sonifierHandle[Symbol.dispose]();
  };

  const disposeEngine = () => {
    disposeHandles(snapshotRef.current.handles);
    snapshotRef.current = {
      ids: null,
      handles: null,
    };
    setHandles(null);

    analyserRef.current = null;
    useAppRuntimeStore.getState().setCurrentUiOpacity(1);
    useAppRuntimeStore.getState().setHasDetectedPoints(false);
  };

  const commitEngineSnapshot = (nextSnapshot: {
    ids: ActiveEnginePluginIds;
    handles: EngineHandles;
  }) => {
    if (snapshotRef.current.handles !== nextSnapshot.handles) {
      disposeHandles(snapshotRef.current.handles);
    }
    snapshotRef.current = {
      ids: nextSnapshot.ids,
      handles: nextSnapshot.handles,
    };
    setHandles(nextSnapshot.handles);

    resizeCanvasRefToContainer(imageOverlayRef);
    initializeAnalyserForVisualizer({
      sonifierHandleRef: { current: nextSnapshot.handles.sonifierHandle },
      analyserRef,
      visualizerFrameDataRef,
      options: {
        fftSize: 2048,
        smoothingTimeConstant: 0.65,
      },
    });

    useAppRuntimeStore.getState().setHasDetectedPoints(false);
    setStatus("ready");
  };
  commitEngineSnapshotRef.current = commitEngineSnapshot;

  const drainInitQueue = useCallback(async () => {
    inFlightRef.current = true;
    try {
      while (pendingSelectionRef.current) {
        const nextSelection = pendingSelectionRef.current;
        pendingSelectionRef.current = null;
        setStatus("initializing");

        const abortController = new AbortController();
        initAbortRef.current = abortController;

        const { pluginConfigs } = useAppConfigStore.getState();
        const result = await runEngineInitTransaction({
          selection: nextSelection,
          signal: abortController.signal,
          config,
          snapshot: snapshotRef.current,
          pluginConfigs,
          imageCanvasRef,
          imageOverlayRef,
        });
        if (initAbortRef.current === abortController) {
          initAbortRef.current = null;
        }

        if (!mountedRef.current) return;
        if (abortController.signal.aborted) continue;
        if (isError(result)) {
          setStatus(result);
          continue;
        }
        commitEngineSnapshotRef.current?.(result);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [config, imageCanvasRef, imageOverlayRef]);

  useEffect(() => {
    pendingSelectionRef.current = {
      detection: activeDetectionPluginId,
      sampling: activeSamplingPluginId,
      sonification: activeSonificationPluginId,
    };
    if (inFlightRef.current) {
      initAbortRef.current?.abort();
      return;
    }
    void drainInitQueue();
  }, [activeDetectionPluginId, activeSamplingPluginId, activeSonificationPluginId, drainInitQueue]);

  disposeEngineRef.current = disposeEngine;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      initAbortRef.current?.abort();
      pendingSelectionRef.current = null;
      disposeEngineRef.current?.();
    };
  }, []);

  return {
    handles,
    status,
  };
};
