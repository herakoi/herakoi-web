import { AsyncDisposableStack, isError } from "errore";
import type { EngineConfig } from "#src/core/plugin";
import { createAppConfigPluginRuntimeContext } from "#src/lib/engine/pluginRuntimeContext";
import {
  createEngineHandles,
  initializeEnginePlugins,
  resolveActiveEnginePlugins,
  startEngineDetection,
} from "#src/lib/engine/startup";
import type {
  ActiveEnginePluginIds,
  EngineHandles,
  EnginePluginSelection,
  EngineSnapshot,
} from "./engineHandles.types";
import { hasSameEnginePluginIds } from "./engineHandles.types";

export const runEngineInitTransaction = async (params: {
  selection: EnginePluginSelection;
  signal: AbortSignal;
  config: EngineConfig;
  snapshot: EngineSnapshot;
  pluginConfigs: Record<string, unknown>;
  imageCanvasRef: { current: HTMLCanvasElement | null };
  imageOverlayRef: { current: HTMLCanvasElement | null };
}): Promise<Error | { ids: ActiveEnginePluginIds; handles: EngineHandles }> => {
  const { selection, signal, config, snapshot, pluginConfigs, imageCanvasRef, imageOverlayRef } =
    params;
  const getAbortError = () => (signal.aborted ? new Error("Engine initialization aborted.") : null);

  const resolvedActivePlugins = resolveActiveEnginePlugins({
    config,
    activePlugins: selection,
    pluginConfigs,
    createRuntimeContext: createAppConfigPluginRuntimeContext,
  });
  if (isError(resolvedActivePlugins)) return resolvedActivePlugins;
  const abortedAfterResolve = getAbortError();
  if (abortedAfterResolve) return abortedAfterResolve;

  const ids: ActiveEnginePluginIds = {
    detectionPluginId: resolvedActivePlugins.detection.id,
    samplingPluginId: resolvedActivePlugins.sampling.id,
    sonificationPluginId: resolvedActivePlugins.sonification.id,
  };

  if (hasSameEnginePluginIds(snapshot.ids, ids) && snapshot.handles) {
    return {
      ids,
      handles: snapshot.handles,
    };
  }

  await using initCleanup = new AsyncDisposableStack();
  const handlesResult = await createEngineHandles(resolvedActivePlugins);
  const abortedAfterCreate = getAbortError();
  if (abortedAfterCreate) return abortedAfterCreate;
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
  const abortedAfterInitialize = getAbortError();
  if (abortedAfterInitialize) return abortedAfterInitialize;
  if (isError(initializeResult)) return initializeResult;

  const startResult = await startEngineDetection(nextHandles.detectorHandle);
  const abortedAfterStart = getAbortError();
  if (abortedAfterStart) return abortedAfterStart;
  if (isError(startResult)) return startResult;

  initCleanup.move();
  return {
    ids,
    handles: nextHandles,
  };
};
