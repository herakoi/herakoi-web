import type { PluginRuntimeContext } from "#src/core/plugin";
import { useAppConfigStore } from "#src/state/appConfigStore";

export const createAppConfigPluginRuntimeContext = (
  pluginId: string,
): PluginRuntimeContext<object> => {
  return {
    getConfig: () => useAppConfigStore.getState().pluginConfigs[pluginId] as object,
    setConfig: (updates) =>
      useAppConfigStore.getState().setPluginConfig(pluginId, updates as Record<string, unknown>),
    subscribeConfig: (listener) =>
      useAppConfigStore.subscribe((state) => {
        listener(state.pluginConfigs[pluginId] as object);
      }),
  };
};
