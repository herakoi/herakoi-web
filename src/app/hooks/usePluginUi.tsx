import { Eye } from "lucide-react";
import { type ComponentType, useCallback, useMemo, useRef } from "react";
import type { PipelineConfig, ShellDockPanelProps, VisualizerDisplayProps } from "#src/core/plugin";
import { PluginSelector } from "../components/PluginSelector";
import { VisualizerPanel } from "../components/panels/VisualizerPanel";
import type { SettingsPanelSection } from "../components/SettingsPanel";
import { useActivePlugin, usePluginConfig, useUiPreferences } from "../state/appConfigStore";

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
  // 1. Subscribe to active plugin IDs and setters from store
  const [activeDetectionId, setActiveDetectionId] = useActivePlugin("detection");
  const [activeSamplingId, setActiveSamplingId] = useActivePlugin("sampling");
  const [activeSonificationId, setActiveSonificationId] = useActivePlugin("sonification");

  // 2. Create plugin switch handler (stop → update → start)
  const createPluginSwitchHandler = useCallback(
    <T extends string>(setActiveId: (id: T) => void) =>
      (id: string) => {
        stop();
        setActiveId(id as T);
        void start();
      },
    [start, stop],
  );

  // 3. Get plugin configs at top level (hooks must be called unconditionally)
  const [sonificationConfig, setSonificationConfig] = usePluginConfig(
    activeSonificationId as keyof import("#src/core/pluginConfig").PluginConfigRegistry,
  );
  const [samplingConfig, setSamplingConfig] = usePluginConfig(
    activeSamplingId as keyof import("#src/core/pluginConfig").PluginConfigRegistry,
  );
  const [detectionConfig, setDetectionConfig] = usePluginConfig(
    activeDetectionId as keyof import("#src/core/pluginConfig").PluginConfigRegistry,
  );

  // 4. Build sections array dynamically from plugins
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
        render: () => {
          // Type assertion is safe: activePluginId guarantees config type matches Panel's expectations
          return (
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
              <Panel config={sonificationConfig as never} setConfig={setSonificationConfig} />
            </>
          );
        },
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
        render: () => {
          // Type assertion is safe: activePluginId guarantees config type matches Panel's expectations
          return (
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
              {Panel && <Panel config={samplingConfig as never} setConfig={setSamplingConfig} />}
            </>
          );
        },
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
        render: () => {
          // Type assertion is safe: activePluginId guarantees config type matches Panel's expectations
          return (
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
              <Panel config={detectionConfig as never} setConfig={setDetectionConfig} />
            </>
          );
        },
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
    sonificationConfig,
    setSonificationConfig,
    samplingConfig,
    setSamplingConfig,
    detectionConfig,
    setDetectionConfig,
  ]);

  // 5. Resolve toolbar and dock panel from active plugins
  const activeSampling = config.sampling.find((p) => p.id === activeSamplingId);
  const SamplingToolbar = useMemo(() => {
    if (!activeSampling?.ui.ToolbarItems) return undefined;
    const ToolbarComponent = activeSampling.ui.ToolbarItems;

    // Create wrapper that provides config props (config comes from closure)
    const ToolbarWithConfig = () => {
      // Type assertion is safe: activePluginId guarantees config type matches ToolbarComponent's expectations
      return <ToolbarComponent config={samplingConfig as never} setConfig={setSamplingConfig} />;
    };

    return ToolbarWithConfig;
  }, [activeSampling, samplingConfig, setSamplingConfig]);

  const activeDetection = config.detection.find((p) => p.id === activeDetectionId);
  const [uiPrefs] = useUiPreferences();

  // Hold the latest config values in a ref so that DockPanel's component identity
  // stays stable across config changes. Recreating the component function on every
  // config update causes React to unmount the old <video> and mount a new one,
  // which detaches the element from the MediaPipePointDetector's camera stream.
  const dockConfigRef = useRef({
    config: detectionConfig,
    setConfig: setDetectionConfig,
    baseUiOpacity: uiPrefs.baseUiOpacity,
  });
  dockConfigRef.current = {
    config: detectionConfig,
    setConfig: setDetectionConfig,
    baseUiOpacity: uiPrefs.baseUiOpacity,
  };

  const DockPanel = useMemo(() => {
    if (!activeDetection?.ui.DockPanel) return undefined;
    const RawDockPanel = activeDetection.ui.DockPanel;
    return function DockPanelWithConfig(shellProps: ShellDockPanelProps) {
      // Read from ref so values are always fresh without changing component identity.
      // Type assertion is safe: activeDetectionId guarantees config type matches DockPanel's expectations
      const { config, setConfig, baseUiOpacity } = dockConfigRef.current;
      return (
        <RawDockPanel
          {...shellProps}
          config={config as never}
          setConfig={setConfig}
          baseUiOpacity={baseUiOpacity}
        />
      );
    };
    // Intentionally omit detectionConfig / setDetectionConfig / uiPrefs.baseUiOpacity:
    // those flow via dockConfigRef so they never change component identity.
  }, [activeDetection]);

  // 6. Resolve active visualizer displays
  const [activeVisualizerId] = useActivePlugin("visualization");
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
