import { Eye } from "lucide-react";
import { type ComponentType, useCallback, useMemo } from "react";
import type { DockPanelProps, PipelineConfig, VisualizerDisplayProps } from "#src/core/plugin";
import { PluginSelector } from "../components/PluginSelector";
import { VisualizerPanel } from "../components/panels/VisualizerPanel";
import type { SettingsPanelSection } from "../components/SettingsPanel";
import { usePipelineStore } from "../state/pipelineStore";

type UsePluginUiParams = {
  config: PipelineConfig;
  start: () => void | Promise<void>;
  stop: () => void;
};

type UsePluginUiReturn = {
  sections: SettingsPanelSection[];
  SamplingToolbar: ComponentType | undefined;
  DockPanel: ComponentType<DockPanelProps> | undefined;
  VisualizerDisplays: Array<{ id: string; Display: ComponentType<VisualizerDisplayProps> }>;
};

export const usePluginUi = ({ config, start, stop }: UsePluginUiParams): UsePluginUiReturn => {
  // 1. Subscribe to active plugin IDs and setters from store
  const activeDetectionId = usePipelineStore((s) => s.activeDetectionId);
  const activeSamplingId = usePipelineStore((s) => s.activeSamplingId);
  const activeSonificationId = usePipelineStore((s) => s.activeSonificationId);
  const setActiveDetectionId = usePipelineStore((s) => s.setActiveDetectionId);
  const setActiveSamplingId = usePipelineStore((s) => s.setActiveSamplingId);
  const setActiveSonificationId = usePipelineStore((s) => s.setActiveSonificationId);

  // 2. Create plugin switch handler (stop → update → start)
  const createPluginSwitchHandler = useCallback(
    (setActiveId: (id: string) => void) => (id: string) => {
      stop();
      setActiveId(id);
      void start();
    },
    [start, stop],
  );

  // 3. Build sections array dynamically from plugins
  const sections = useMemo(() => {
    const result: SettingsPanelSection[] = [];

    // Sonification plugin settings tab
    const activeSonification = config.sonification.find((p) => p.id === activeSonificationId);
    if (activeSonification?.settingsTab && activeSonification.ui.SettingsPanel) {
      const Panel = activeSonification.ui.SettingsPanel;
      result.push({
        key: activeSonification.settingsTab.key,
        label: activeSonification.settingsTab.label,
        icon: activeSonification.settingsTab.icon,
        render: () => (
          <>
            <PluginSelector
              label="Sonification"
              plugins={config.sonification.map((p) => ({
                id: p.id,
                displayName: p.displayName,
              }))}
              activeId={activeSonificationId}
              onSelect={createPluginSwitchHandler(setActiveSonificationId)}
            />
            <Panel />
          </>
        ),
      });
    }

    // Sampling plugin settings tab
    const activeSamplingPlugin = config.sampling.find((p) => p.id === activeSamplingId);
    if (activeSamplingPlugin?.settingsTab) {
      const Panel = activeSamplingPlugin.ui.SettingsPanel;
      result.push({
        key: activeSamplingPlugin.settingsTab.key,
        label: activeSamplingPlugin.settingsTab.label,
        icon: activeSamplingPlugin.settingsTab.icon,
        render: () => (
          <>
            <PluginSelector
              label="Sampling"
              plugins={config.sampling.map((p) => ({
                id: p.id,
                displayName: p.displayName,
              }))}
              activeId={activeSamplingId}
              onSelect={createPluginSwitchHandler(setActiveSamplingId)}
            />
            {Panel && <Panel />}
          </>
        ),
      });
    }

    // Detection plugin settings tab
    const activeDetection = config.detection.find((p) => p.id === activeDetectionId);
    if (activeDetection?.settingsTab && activeDetection.ui.SettingsPanel) {
      const Panel = activeDetection.ui.SettingsPanel;
      result.push({
        key: activeDetection.settingsTab.key,
        label: activeDetection.settingsTab.label,
        icon: activeDetection.settingsTab.icon,
        render: () => (
          <>
            <PluginSelector
              label="Detection"
              plugins={config.detection.map((p) => ({
                id: p.id,
                displayName: p.displayName,
              }))}
              activeId={activeDetectionId}
              onSelect={createPluginSwitchHandler(setActiveDetectionId)}
            />
            <Panel />
          </>
        ),
      });
    }

    // Visualizer section (only if visualizers are available)
    if (config.visualization.length > 0) {
      result.push({
        key: "visualizer",
        label: "Visualizer",
        icon: <Eye className="h-3.5 w-3.5" />,
        render: () => <VisualizerPanel visualizers={config.visualization} />,
      });
    }

    return result;
  }, [
    config,
    activeSonificationId,
    activeSamplingId,
    activeDetectionId,
    createPluginSwitchHandler,
    setActiveSonificationId,
    setActiveSamplingId,
    setActiveDetectionId,
  ]);

  // 4. Resolve toolbar and dock panel from active plugins
  const activeSampling = config.sampling.find((p) => p.id === activeSamplingId);
  const SamplingToolbar = activeSampling?.ui.ToolbarItems;

  const activeDetection = config.detection.find((p) => p.id === activeDetectionId);
  const DockPanel = activeDetection?.ui.DockPanel;

  // 5. Resolve active visualizer displays
  const activeVisualizerId = usePipelineStore((s) => s.activeVisualizerId);
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
