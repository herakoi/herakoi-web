import { type ComponentType, useMemo } from "react";
import type { PipelineConfig, ShellDockPanelProps, VisualizerDisplayProps } from "#src/core/plugin";
import type { SettingsPanelSection } from "../../components/SettingsPanel";
import { useActivePlugin } from "../../state/appConfigStore";
import { usePluginDockPanel } from "./usePluginDockPanel";
import { usePluginSections } from "./usePluginSections";
import { usePluginToolbar } from "./usePluginToolbar";

type UsePluginUiParams = {
  config: PipelineConfig;
  start: () => void | Promise<void>;
  stop: () => void;
};

type UsePluginUiReturn = {
  sections: SettingsPanelSection[];
  SamplingToolbar: ComponentType | undefined;
  DockPanel: ComponentType<ShellDockPanelProps> | undefined;
  VisualizerDisplays: Array<{ id: string; Display: ComponentType<VisualizerDisplayProps> }>;
};

export const usePluginUi = ({ config, start, stop }: UsePluginUiParams): UsePluginUiReturn => {
  // Get active plugin IDs from store
  const [activeDetectionId] = useActivePlugin("detection");
  const [activeSamplingId] = useActivePlugin("sampling");
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

  return {
    sections,
    SamplingToolbar,
    DockPanel,
    VisualizerDisplays,
  };
};
