import { type ComponentType, useMemo } from "react";
import type { EngineConfig, ShellDockPanelProps, VisualizerDisplayProps } from "#src/core/plugin";
import type { SettingsPanelSection } from "../../components/SettingsPanel";
import { useActivePlugin } from "../../state/appConfigStore";
import { usePluginDockPanel } from "./usePluginDockPanel";
import { usePluginSections } from "./usePluginSections";
import { usePluginToolbar } from "./usePluginToolbar";

type UsePluginUiParams = {
  config: EngineConfig;
  start: (options?: { transport?: "on" | "off" }) => Promise<unknown>;
  stop: () => void;
};

type UsePluginUiReturn = {
  sections: SettingsPanelSection[];
  SamplingToolbar: ComponentType | undefined;
  DockPanel: ComponentType<ShellDockPanelProps> | undefined;
  VisualizerDisplays: Array<{ id: string; Display: ComponentType<VisualizerDisplayProps> }>;
  PluginNotificationComponents: Array<{ id: string; Notifications: ComponentType }>;
};

export const usePluginUi = ({ config, start, stop }: UsePluginUiParams): UsePluginUiReturn => {
  // Get active plugin IDs from store
  const [activeDetectionId] = useActivePlugin("detection");
  const [activeSamplingId] = useActivePlugin("sampling");
  const [activeSonificationId] = useActivePlugin("sonification");
  const [activeVisualizerId] = useActivePlugin("visualization");

  // Build settings panel sections
  const sections = usePluginSections({ config, start, stop });

  // Resolve sampling toolbar
  const SamplingToolbar = usePluginToolbar({ config, activeSamplingId });

  // Resolve detection dock panel
  const DockPanel = usePluginDockPanel({ config, activeDetectionId });

  // Resolve active visualizer displays
  const VisualizerDisplays = useMemo(() => {
    if (!activeVisualizerId) return [];
    return config.visualization
      .filter((p) => p.id === activeVisualizerId && p.ui.VisualizerDisplay)
      .map((p) => ({
        id: p.id,
        Display: p.ui.VisualizerDisplay as ComponentType<VisualizerDisplayProps>,
      }));
  }, [config.visualization, activeVisualizerId]);

  // Collect Notifications components from all active engine plugins
  const PluginNotificationComponents = useMemo(() => {
    const result: Array<{ id: string; Notifications: ComponentType }> = [];

    const activeDetection = config.detection.find((p) => p.id === activeDetectionId);
    if (activeDetection?.ui.Notifications) {
      result.push({ id: activeDetection.id, Notifications: activeDetection.ui.Notifications });
    }

    const activeSampling = config.sampling.find((p) => p.id === activeSamplingId);
    if (activeSampling?.ui.Notifications) {
      result.push({ id: activeSampling.id, Notifications: activeSampling.ui.Notifications });
    }

    const activeSonification = config.sonification.find((p) => p.id === activeSonificationId);
    if (activeSonification?.ui.Notifications) {
      result.push({
        id: activeSonification.id,
        Notifications: activeSonification.ui.Notifications,
      });
    }

    return result;
  }, [config, activeDetectionId, activeSamplingId, activeSonificationId]);

  return {
    sections,
    SamplingToolbar,
    DockPanel,
    VisualizerDisplays,
    PluginNotificationComponents,
  };
};
