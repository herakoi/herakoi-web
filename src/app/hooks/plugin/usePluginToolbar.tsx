import { type ComponentType, useMemo, useRef } from "react";
import type { PipelineConfig } from "#src/core/plugin";
import type { PluginConfigRegistry } from "#src/core/pluginConfig";
import { usePluginConfig } from "../../state/appConfigStore";

type UsePluginToolbarParams = {
  config: PipelineConfig;
  activeSamplingId: string;
};

export const usePluginToolbar = ({
  config,
  activeSamplingId,
}: UsePluginToolbarParams): ComponentType | undefined => {
  // Get plugin config
  const [samplingConfig, setSamplingConfig] = usePluginConfig(
    activeSamplingId as keyof PluginConfigRegistry,
  );

  // Create ref to hold latest config values
  const samplingConfigRef = useRef({
    config: samplingConfig,
    setConfig: setSamplingConfig,
  });
  samplingConfigRef.current = {
    config: samplingConfig,
    setConfig: setSamplingConfig,
  };

  // Resolve active sampling plugin
  const activeSampling = config.sampling.find((p) => p.id === activeSamplingId);

  const SamplingToolbar = useMemo(() => {
    if (!activeSampling?.ui.ToolbarItems) return undefined;
    const ToolbarComponent = activeSampling.ui.ToolbarItems;

    const ToolbarWithConfig = () => {
      // Read from ref so values stay fresh while component identity remains stable.
      // Type assertion is safe: activeSamplingId guarantees config type matches ToolbarComponent's expectations
      const { config, setConfig } = samplingConfigRef.current;
      return <ToolbarComponent config={config as never} setConfig={setConfig} />;
    };

    return ToolbarWithConfig;
    // Intentionally omit samplingConfig / setSamplingConfig:
    // those flow via samplingConfigRef to avoid remount loops.
  }, [activeSampling]);

  return SamplingToolbar;
};
