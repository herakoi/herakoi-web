import { type ComponentType, useMemo, useRef } from "react";
import type { PipelineConfig, ShellDockPanelProps } from "#src/core/plugin";
import type { AppPluginConfigRegistry } from "#src/pluginConfigRegistry";
import { usePluginConfig } from "../../state/appConfigStore";

type UsePluginDockPanelParams = {
  config: PipelineConfig;
  activeDetectionId: string;
};

export const usePluginDockPanel = ({
  config,
  activeDetectionId,
}: UsePluginDockPanelParams): ComponentType<ShellDockPanelProps> | undefined => {
  // Get plugin config
  const [detectionConfig, setDetectionConfig] = usePluginConfig(
    activeDetectionId as keyof AppPluginConfigRegistry,
  );

  // Create ref to hold latest config values
  const detectionConfigRef = useRef({
    config: detectionConfig,
    setConfig: setDetectionConfig,
  });
  detectionConfigRef.current = {
    config: detectionConfig,
    setConfig: setDetectionConfig,
  };

  // Resolve active detection plugin
  const activeDetection = config.detection.find((p) => p.id === activeDetectionId);

  const DockPanel = useMemo(() => {
    if (!activeDetection?.ui.DockPanel) return undefined;
    const RawDockPanel = activeDetection.ui.DockPanel;
    return function DockPanelWithConfig(shellProps: ShellDockPanelProps) {
      // Read from ref so values are always fresh without changing component identity.
      // Type assertion is safe: activeDetectionId guarantees config type matches DockPanel's expectations
      const { config, setConfig } = detectionConfigRef.current;
      return <RawDockPanel {...shellProps} config={config as never} setConfig={setConfig} />;
    };
    // Intentionally omit detectionConfig / setDetectionConfig:
    // those flow via detectionConfigRef so they never change component identity.
  }, [activeDetection]);

  return DockPanel;
};
