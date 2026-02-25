import { useMemo } from "react";
import type { EngineRuntimeError } from "#src/core/domain-errors";
import type { EngineConfig } from "#src/core/plugin";
import { createAppConfigPluginRuntimeContext } from "#src/lib/engine/pluginRuntimeContext";
import { type ResolvedEnginePlugins, resolveActiveEnginePlugins } from "#src/lib/engine/startup";
import { useAppConfigStore } from "../state/appConfigStore";

export const useResolvedEnginePlugins = (
  config: EngineConfig,
): EngineRuntimeError | ResolvedEnginePlugins => {
  const activePlugins = useAppConfigStore((state) => state.activePlugins);
  const pluginConfigs = useAppConfigStore((state) => state.pluginConfigs);

  return useMemo(() => {
    return resolveActiveEnginePlugins({
      config,
      activePlugins,
      pluginConfigs,
      createRuntimeContext: createAppConfigPluginRuntimeContext,
    });
  }, [config, activePlugins, pluginConfigs]);
};
