import type { DetectorHandle, SamplerHandle, SonifierHandle } from "#src/core/plugin";

export type ActiveEnginePluginIds = {
  detectionPluginId: string;
  samplingPluginId: string;
  sonificationPluginId: string;
};

export type EnginePluginSelection = {
  detection: string;
  sampling: string;
  sonification: string;
};

export type EngineHandles = {
  detectorHandle: DetectorHandle;
  samplerHandle: SamplerHandle;
  sonifierHandle: SonifierHandle;
};

export type EngineSnapshot = {
  ids: ActiveEnginePluginIds | null;
  handles: EngineHandles | null;
};

export type EngineHandlesStatus = "initializing" | "ready" | Error;

export const hasSameEnginePluginIds = (
  left: ActiveEnginePluginIds | null,
  right: ActiveEnginePluginIds,
) => {
  if (!left) return false;
  return (
    left.detectionPluginId === right.detectionPluginId &&
    left.samplingPluginId === right.samplingPluginId &&
    left.sonificationPluginId === right.sonificationPluginId
  );
};
