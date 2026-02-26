import { isError, tryAsync } from "errore";
import {
  DetectionInitializeError,
  DetectionPostInitializeError,
  DetectionStartError,
  type EngineRuntimeError,
  InvalidPluginConfigurationError,
  PluginCreationError,
  SamplingPostInitializeError,
  SonifierInitializeError,
} from "#src/core/domain-errors";
import type {
  DetectionPlugin,
  DetectorHandle,
  EngineConfig,
  PluginRuntimeContext,
  SamplerHandle,
  SamplingPlugin,
  SonificationPlugin,
  SonifierHandle,
} from "#src/core/plugin";
import { safelyCreatePluginHandle } from "./runtime";

type EngineResult<T> = EngineRuntimeError | T;

type ActiveEnginePlugins = {
  detection: string;
  sampling: string;
  sonification: string;
};

type PluginConfigMap = Record<string, unknown>;

type CreateRuntimeContext = (pluginId: string) => PluginRuntimeContext<object>;

export type ResolvedEnginePlugins = {
  detection: {
    id: string;
    plugin: DetectionPlugin;
    config: unknown;
    runtime: PluginRuntimeContext<object>;
  };
  sampling: {
    id: string;
    plugin: SamplingPlugin;
    config: unknown;
    runtime: PluginRuntimeContext<object>;
  };
  sonification: {
    id: string;
    plugin: SonificationPlugin;
    config: unknown;
    runtime: PluginRuntimeContext<object>;
  };
};

export type EngineHandles = {
  detectorHandle: DetectorHandle;
  samplerHandle: SamplerHandle;
  sonifierHandle: SonifierHandle;
};

export const resolveActiveEnginePlugins = (params: {
  config: EngineConfig;
  activePlugins: ActiveEnginePlugins;
  pluginConfigs: PluginConfigMap;
  createRuntimeContext: CreateRuntimeContext;
}): EngineResult<ResolvedEnginePlugins> => {
  const { config, activePlugins, pluginConfigs, createRuntimeContext } = params;

  const activeDetection = config.detection.find((plugin) => plugin.id === activePlugins.detection);
  const activeSampling = config.sampling.find((plugin) => plugin.id === activePlugins.sampling);
  const activeSonification = config.sonification.find(
    (plugin) => plugin.id === activePlugins.sonification,
  );
  if (!activeDetection || !activeSampling || !activeSonification) {
    return new InvalidPluginConfigurationError();
  }

  return {
    detection: {
      id: activeDetection.id,
      plugin: activeDetection,
      config: pluginConfigs[activeDetection.id],
      runtime: createRuntimeContext(activeDetection.id),
    },
    sampling: {
      id: activeSampling.id,
      plugin: activeSampling,
      config: pluginConfigs[activeSampling.id],
      runtime: createRuntimeContext(activeSampling.id),
    },
    sonification: {
      id: activeSonification.id,
      plugin: activeSonification,
      config: pluginConfigs[activeSonification.id],
      runtime: createRuntimeContext(activeSonification.id),
    },
  };
};

export const createEngineHandles = async (
  resolved: ResolvedEnginePlugins,
): Promise<EngineResult<EngineHandles>> => {
  const [detectionHandleResult, samplingHandleResult, sonificationHandleResult] = await Promise.all(
    [
      safelyCreatePluginHandle(() =>
        resolved.detection.plugin.createDetector(
          resolved.detection.config as never,
          resolved.detection.runtime as never,
        ),
      ),
      safelyCreatePluginHandle(() =>
        resolved.sampling.plugin.createSampler(
          resolved.sampling.config as never,
          resolved.sampling.runtime as never,
        ),
      ),
      safelyCreatePluginHandle(() =>
        resolved.sonification.plugin.createSonifier(
          resolved.sonification.config as never,
          resolved.sonification.runtime as never,
        ),
      ),
    ],
  );

  const disposeCreatedHandles = () => {
    if (!isError(sonificationHandleResult)) sonificationHandleResult[Symbol.dispose]();
    if (!isError(samplingHandleResult)) samplingHandleResult[Symbol.dispose]();
    if (!isError(detectionHandleResult)) detectionHandleResult[Symbol.dispose]();
  };

  if (isError(detectionHandleResult)) {
    disposeCreatedHandles();
    return new PluginCreationError({ cause: detectionHandleResult });
  }
  if (isError(samplingHandleResult)) {
    disposeCreatedHandles();
    return new PluginCreationError({ cause: samplingHandleResult });
  }
  if (isError(sonificationHandleResult)) {
    disposeCreatedHandles();
    return new PluginCreationError({ cause: sonificationHandleResult });
  }

  return {
    detectorHandle: detectionHandleResult,
    samplerHandle: samplingHandleResult,
    sonifierHandle: sonificationHandleResult,
  };
};

export const initializeEnginePlugins = async (params: {
  detectorHandle: DetectorHandle;
  samplerHandle: SamplerHandle;
  sonifierHandle: SonifierHandle;
  imageOverlayRef: { current: HTMLCanvasElement | null };
  imageCanvasRef: { current: HTMLCanvasElement | null };
}): Promise<EngineResult<undefined>> => {
  const { detectorHandle, samplerHandle, sonifierHandle, imageOverlayRef, imageCanvasRef } = params;

  detectorHandle.setCanvasRefs?.({ imageOverlay: imageOverlayRef });
  samplerHandle.setCanvasRefs?.({ imageCanvas: imageCanvasRef });

  const samplerPostInitialize = await tryAsync({
    try: async () => samplerHandle.postInitialize?.(),
    catch: (error) => new SamplingPostInitializeError({ cause: error }),
  });
  if (isError(samplerPostInitialize)) {
    return samplerPostInitialize;
  }

  const detectorInitialize = await tryAsync({
    try: async () => detectorHandle.detector.initialize(),
    catch: (error) => new DetectionInitializeError({ cause: error }),
  });
  if (isError(detectorInitialize)) {
    if (detectorInitialize instanceof DetectionInitializeError) {
      return detectorInitialize;
    }
    return new DetectionInitializeError({ cause: detectorInitialize });
  }

  const sonifierInitialize = await tryAsync({
    try: async () => sonifierHandle.sonifier.initialize(),
    catch: (error) => new SonifierInitializeError({ cause: error }),
  });
  if (isError(sonifierInitialize)) {
    if (sonifierInitialize instanceof SonifierInitializeError) {
      return sonifierInitialize;
    }
    return new SonifierInitializeError({ cause: sonifierInitialize });
  }
};

export const startEngineDetection = async (
  detectorHandle: DetectorHandle,
): Promise<EngineResult<undefined>> => {
  const detectorStart = await tryAsync({
    try: async () => detectorHandle.detector.start(),
    catch: (error) => new DetectionStartError({ cause: error }),
  });
  if (isError(detectorStart)) {
    if (detectorStart instanceof DetectionStartError) {
      return detectorStart;
    }
    return new DetectionStartError({ cause: detectorStart });
  }

  const detectorPostInitialize = await tryAsync({
    try: async () => detectorHandle.postInitialize?.(),
    catch: (error) => new DetectionPostInitializeError({ cause: error }),
  });
  if (isError(detectorPostInitialize)) {
    return detectorPostInitialize;
  }
};
