import { isError } from "errore";
import {
  DetectionInitializeError,
  DetectionPostInitializeError,
  DetectionStartError,
  SamplingPostInitializeError,
  SonifierInitializeError,
} from "#src/core/domain-errors";
import type { EngineConfig } from "#src/core/plugin";
import { createAppConfigPluginRuntimeContext } from "#src/lib/engine/pluginRuntimeContext";
import { safelyCreatePluginHandle } from "#src/lib/engine/runtime";
import { resolveActiveEnginePlugins } from "#src/lib/engine/startup";
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

  let nextHandles: EngineHandles | null = null;
  let retainHandles = false;

  try {
    const previousHandles = snapshot.handles;
    const previousIds = snapshot.ids;

    const reuseDetection =
      previousHandles &&
      previousIds?.detectionPluginId === ids.detectionPluginId &&
      previousHandles.detectorHandle;
    const reuseSampling =
      previousHandles &&
      previousIds?.samplingPluginId === ids.samplingPluginId &&
      previousHandles.samplerHandle;
    const reuseSonification =
      previousHandles &&
      previousIds?.sonificationPluginId === ids.sonificationPluginId &&
      previousHandles.sonifierHandle;

    const detectorHandle = reuseDetection
      ? reuseDetection
      : await safelyCreatePluginHandle(() =>
          resolvedActivePlugins.detection.plugin.createDetector(
            resolvedActivePlugins.detection.config as never,
            resolvedActivePlugins.detection.runtime as never,
          ),
        );
    if (isError(detectorHandle)) return detectorHandle;

    const samplerHandle = reuseSampling
      ? reuseSampling
      : await safelyCreatePluginHandle(() =>
          resolvedActivePlugins.sampling.plugin.createSampler(
            resolvedActivePlugins.sampling.config as never,
            resolvedActivePlugins.sampling.runtime as never,
          ),
        );
    if (isError(samplerHandle)) return samplerHandle;

    const sonifierHandle = reuseSonification
      ? reuseSonification
      : await safelyCreatePluginHandle(() =>
          resolvedActivePlugins.sonification.plugin.createSonifier(
            resolvedActivePlugins.sonification.config as never,
            resolvedActivePlugins.sonification.runtime as never,
          ),
        );
    if (isError(sonifierHandle)) return sonifierHandle;

    nextHandles = {
      detectorHandle,
      samplerHandle,
      sonifierHandle,
    };

    nextHandles.detectorHandle.setCanvasRefs?.({ imageOverlay: imageOverlayRef });
    nextHandles.samplerHandle.setCanvasRefs?.({ imageCanvas: imageCanvasRef });

    if (!reuseSampling) {
      try {
        await nextHandles.samplerHandle.postInitialize?.();
      } catch (error) {
        return new SamplingPostInitializeError({ cause: error });
      }
    }

    if (!reuseDetection) {
      try {
        const detectorInitialize = await nextHandles.detectorHandle.detector.initialize();
        if (isError(detectorInitialize)) {
          return new DetectionInitializeError({ cause: detectorInitialize });
        }
      } catch (error) {
        return new DetectionInitializeError({ cause: error });
      }
    }

    if (!reuseSonification) {
      try {
        const sonifierInitialize = await nextHandles.sonifierHandle.sonifier.initialize();
        if (isError(sonifierInitialize)) {
          return new SonifierInitializeError({ cause: sonifierInitialize });
        }
      } catch (error) {
        return new SonifierInitializeError({ cause: error });
      }
    }

    const abortedAfterInitialize = getAbortError();
    if (abortedAfterInitialize) return abortedAfterInitialize;

    if (!reuseDetection) {
      try {
        const detectorStart = await nextHandles.detectorHandle.detector.start();
        if (isError(detectorStart)) {
          return new DetectionStartError({ cause: detectorStart });
        }
      } catch (error) {
        return new DetectionStartError({ cause: error });
      }

      try {
        await nextHandles.detectorHandle.postInitialize?.();
      } catch (error) {
        return new DetectionPostInitializeError({ cause: error });
      }
    }

    const abortedAfterStart = getAbortError();
    if (abortedAfterStart) return abortedAfterStart;

    retainHandles = true;
    return {
      ids,
      handles: nextHandles,
    };
  } finally {
    if (!retainHandles && nextHandles) {
      const previousHandles = snapshot.handles;
      if (nextHandles.detectorHandle !== previousHandles?.detectorHandle) {
        nextHandles.detectorHandle[Symbol.dispose]();
      }
      if (nextHandles.samplerHandle !== previousHandles?.samplerHandle) {
        nextHandles.samplerHandle[Symbol.dispose]();
      }
      if (nextHandles.sonifierHandle !== previousHandles?.sonifierHandle) {
        nextHandles.sonifierHandle[Symbol.dispose]();
      }
    }
  }
};
