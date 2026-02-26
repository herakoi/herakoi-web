import { AsyncDisposableStack, isError } from "errore";
import {
  type MutableRefObject,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { EngineCanvasNotReadyError } from "#src/core/domain-errors";
import type {
  DetectorHandle,
  EngineConfig,
  SamplerHandle,
  SonifierHandle,
  VisualizerFrameData,
} from "#src/core/plugin";
import { createAppConfigPluginRuntimeContext } from "#src/lib/engine/pluginRuntimeContext";
import {
  createEngineHandles,
  initializeEnginePlugins,
  resolveActiveEnginePlugins,
  startEngineDetection,
} from "#src/lib/engine/startup";
import { initializeAnalyserForVisualizer } from "#src/lib/engine/visualizerFrame";
import { useAppConfigStore } from "#src/state/appConfigStore";
import { useAppRuntimeStore } from "#src/state/appRuntimeStore";
import { resizeCanvasRefToContainer } from "../ui/canvas";

type Refs = {
  imageCanvasRef: RefObject<HTMLCanvasElement>;
  imageOverlayRef: RefObject<HTMLCanvasElement>;
};

type ActiveEnginePluginIds = {
  detectionPluginId: string;
  samplingPluginId: string;
  sonificationPluginId: string;
};

type EnginePluginSelection = {
  detection: string;
  sampling: string;
  sonification: string;
};

type EngineSnapshot = {
  ids: ActiveEnginePluginIds | null;
  handles: EngineHandles | null;
};

export type EngineHandles = {
  detectorHandle: DetectorHandle;
  samplerHandle: SamplerHandle;
  sonifierHandle: SonifierHandle;
};

export type EngineHandlesStatus = "initializing" | "ready" | Error;

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
  const pendingSelectionRef = useRef<EnginePluginSelection | null>(null);
  const currentInitAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const [handles, setHandles] = useState<EngineHandles | null>(null);
  const [status, setStatus] = useState<EngineHandlesStatus>("initializing");

  const setStatusState = useCallback((nextStatus: EngineHandlesStatus) => {
    setStatus(nextStatus);
  }, []);

  const setHandlesState = useCallback((nextHandles: EngineHandles | null) => {
    snapshotRef.current = {
      ...snapshotRef.current,
      handles: nextHandles,
    };
    setHandles(nextHandles);
  }, []);

  const setSnapshotPluginIds = useCallback((nextIds: ActiveEnginePluginIds | null) => {
    snapshotRef.current = {
      ...snapshotRef.current,
      ids: nextIds,
    };
  }, []);

  const disposeHandles = useCallback((targetHandles: EngineHandles | null) => {
    targetHandles?.detectorHandle[Symbol.dispose]();
    targetHandles?.samplerHandle[Symbol.dispose]();
    targetHandles?.sonifierHandle[Symbol.dispose]();
  }, []);

  const disposeEngine = useCallback(() => {
    disposeHandles(snapshotRef.current.handles);
    snapshotRef.current = {
      ids: null,
      handles: null,
    };
    setHandlesState(null);

    analyserRef.current = null;
    useAppRuntimeStore.getState().setCurrentUiOpacity(1);
    useAppRuntimeStore.getState().setHasDetectedPoints(false);
  }, [analyserRef, disposeHandles, setHandlesState]);

  const runInitTransaction = useCallback(
    async (
      selection: EnginePluginSelection,
      signal: AbortSignal,
    ): Promise<Error | { ids: ActiveEnginePluginIds; handles: EngineHandles }> => {
      const abortIfNeeded = () => {
        if (!signal.aborted) return;
        throw new Error("Engine initialization aborted.");
      };

      const { pluginConfigs } = useAppConfigStore.getState();
      const resolvedActivePlugins = resolveActiveEnginePlugins({
        config,
        activePlugins: selection,
        pluginConfigs,
        createRuntimeContext: createAppConfigPluginRuntimeContext,
      });
      if (isError(resolvedActivePlugins)) return resolvedActivePlugins;
      abortIfNeeded();

      const ids: ActiveEnginePluginIds = {
        detectionPluginId: resolvedActivePlugins.detection.id,
        samplingPluginId: resolvedActivePlugins.sampling.id,
        sonificationPluginId: resolvedActivePlugins.sonification.id,
      };

      const snapshot = snapshotRef.current;
      const samePlugins =
        snapshot.ids?.detectionPluginId === ids.detectionPluginId &&
        snapshot.ids?.samplingPluginId === ids.samplingPluginId &&
        snapshot.ids?.sonificationPluginId === ids.sonificationPluginId;
      if (samePlugins && snapshot.handles) {
        return {
          ids,
          handles: snapshot.handles,
        };
      }

      if (!imageCanvasRef.current) {
        return new EngineCanvasNotReadyError();
      }

      await using initCleanup = new AsyncDisposableStack();
      const handlesResult = await createEngineHandles(resolvedActivePlugins);
      abortIfNeeded();
      if (isError(handlesResult)) return handlesResult;

      const nextHandles: EngineHandles = {
        detectorHandle: handlesResult.detectorHandle,
        samplerHandle: handlesResult.samplerHandle,
        sonifierHandle: handlesResult.sonifierHandle,
      };
      initCleanup.use(nextHandles.detectorHandle);
      initCleanup.use(nextHandles.samplerHandle);
      initCleanup.use(nextHandles.sonifierHandle);

      const initializeResult = await initializeEnginePlugins({
        detectorHandle: nextHandles.detectorHandle,
        samplerHandle: nextHandles.samplerHandle,
        sonifierHandle: nextHandles.sonifierHandle,
        imageOverlayRef,
        imageCanvasRef,
      });
      abortIfNeeded();
      if (isError(initializeResult)) return initializeResult;

      const startResult = await startEngineDetection(nextHandles.detectorHandle);
      abortIfNeeded();
      if (isError(startResult)) return startResult;

      initCleanup.move();
      return {
        ids,
        handles: nextHandles,
      };
    },
    [config, imageCanvasRef, imageOverlayRef],
  );

  const commitEngineSnapshot = useCallback(
    (nextSnapshot: { ids: ActiveEnginePluginIds; handles: EngineHandles }) => {
      if (snapshotRef.current.handles !== nextSnapshot.handles) {
        disposeHandles(snapshotRef.current.handles);
      }
      setSnapshotPluginIds(nextSnapshot.ids);
      setHandlesState(nextSnapshot.handles);

      resizeCanvasRefToContainer(imageOverlayRef);
      initializeAnalyserForVisualizer({
        sonifierHandleRef: { current: nextSnapshot.handles.sonifierHandle as SonifierHandle },
        analyserRef,
        visualizerFrameDataRef,
        options: {
          fftSize: 2048,
          smoothingTimeConstant: 0.65,
        },
      });

      useAppRuntimeStore.getState().setHasDetectedPoints(false);
      setStatusState("ready");
    },
    [
      analyserRef,
      disposeHandles,
      imageOverlayRef,
      setHandlesState,
      setSnapshotPluginIds,
      setStatusState,
      visualizerFrameDataRef,
    ],
  );

  const drainInitializationQueue = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      while (pendingSelectionRef.current) {
        const nextSelection = pendingSelectionRef.current;
        pendingSelectionRef.current = null;
        setStatusState("initializing");

        const abortController = new AbortController();
        currentInitAbortRef.current = abortController;

        let result: Error | { ids: ActiveEnginePluginIds; handles: EngineHandles };
        try {
          result = await runInitTransaction(nextSelection, abortController.signal);
        } catch (error) {
          if (abortController.signal.aborted) {
            continue;
          }
          result = error instanceof Error ? error : new Error("Engine initialization failed.");
        } finally {
          if (currentInitAbortRef.current === abortController) {
            currentInitAbortRef.current = null;
          }
        }

        if (!mountedRef.current) return;
        if (abortController.signal.aborted) {
          continue;
        }
        if (isError(result)) {
          setStatusState(result);
          continue;
        }
        commitEngineSnapshot(result);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [commitEngineSnapshot, runInitTransaction, setStatusState]);

  const requestInitialization = useCallback(
    (selection: EnginePluginSelection) => {
      pendingSelectionRef.current = selection;
      if (inFlightRef.current) {
        currentInitAbortRef.current?.abort();
        return;
      }
      void drainInitializationQueue();
    },
    [drainInitializationQueue],
  );

  useEffect(() => {
    requestInitialization({
      detection: activeDetectionPluginId,
      sampling: activeSamplingPluginId,
      sonification: activeSonificationPluginId,
    });
  }, [
    activeDetectionPluginId,
    activeSamplingPluginId,
    activeSonificationPluginId,
    requestInitialization,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      currentInitAbortRef.current?.abort();
      pendingSelectionRef.current = null;
      disposeEngine();
    };
  }, [disposeEngine]);

  return {
    handles,
    status,
  };
};
