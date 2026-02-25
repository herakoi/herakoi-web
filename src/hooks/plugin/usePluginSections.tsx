import { Eye } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import type { PipelineConfig } from "#src/core/plugin";
import { VisualizerPanel } from "../../components/panels/VisualizerPanel";
import type { SettingsPanelSection } from "../../components/SettingsPanel";
import type { ActivePlugins } from "../../state/appConfigStore";
import { useActivePlugin, usePluginConfig } from "../../state/appConfigStore";
import { buildPluginSection } from "./buildPluginSection";

type UsePluginSectionsParams = {
  config: PipelineConfig;
  start: () => Promise<unknown>;
  stop: () => void;
};

export const usePluginSections = ({
  config,
  start,
  stop,
}: UsePluginSectionsParams): SettingsPanelSection[] => {
  // 1. Subscribe to active plugin IDs and setters from store
  const [activeDetectionId, setActiveDetectionId] = useActivePlugin("detection");
  const [activeSamplingId, setActiveSamplingId] = useActivePlugin("sampling");
  const [activeSonificationId, setActiveSonificationId] = useActivePlugin("sonification");

  // 2. Get plugin configs at top level (hooks must be called unconditionally)
  const [sonificationConfig, setSonificationConfig] = usePluginConfig(activeSonificationId);
  const [samplingConfig, setSamplingConfig] = usePluginConfig(activeSamplingId);
  const [detectionConfig, setDetectionConfig] = usePluginConfig(activeDetectionId);

  // 3. Create individual plugin switch handlers (stop → update → start)
  const handleSonificationSwitch = useCallback(
    (id: string) => {
      stop();
      setActiveSonificationId(id as ActivePlugins["sonification"]);
      void start();
    },
    [start, stop, setActiveSonificationId],
  );

  const handleSamplingSwitch = useCallback(
    (id: string) => {
      stop();
      setActiveSamplingId(id as ActivePlugins["sampling"]);
      void start();
    },
    [start, stop, setActiveSamplingId],
  );

  const handleDetectionSwitch = useCallback(
    (id: string) => {
      stop();
      setActiveDetectionId(id as ActivePlugins["detection"]);
      void start();
    },
    [start, stop, setActiveDetectionId],
  );

  // 4. Create refs to hold latest config values (standardized ref pattern for all dynamic plugin UI)
  const sonificationConfigRef = useRef({
    config: sonificationConfig,
    setConfig: setSonificationConfig,
  });
  sonificationConfigRef.current = {
    config: sonificationConfig,
    setConfig: setSonificationConfig,
  };

  const samplingConfigRef = useRef({
    config: samplingConfig,
    setConfig: setSamplingConfig,
  });
  samplingConfigRef.current = {
    config: samplingConfig,
    setConfig: setSamplingConfig,
  };

  const detectionConfigRef = useRef({
    config: detectionConfig,
    setConfig: setDetectionConfig,
  });
  detectionConfigRef.current = {
    config: detectionConfig,
    setConfig: setDetectionConfig,
  };

  // 5. Build individual sections with stable dependencies (config flows through refs)
  const sonificationSection = useMemo(
    () =>
      buildPluginSection({
        label: "Sonification",
        pluginArray: config.sonification,
        activeId: activeSonificationId,
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed due to contravariance in setConfig function parameter
        configRef: sonificationConfigRef as any,
        onSwitchPlugin: handleSonificationSwitch,
      }),
    [config.sonification, activeSonificationId, handleSonificationSwitch],
  );

  const samplingSection = useMemo(
    () =>
      buildPluginSection({
        label: "Sampling",
        pluginArray: config.sampling,
        activeId: activeSamplingId,
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed due to contravariance in setConfig function parameter
        configRef: samplingConfigRef as any,
        onSwitchPlugin: handleSamplingSwitch,
      }),
    [config.sampling, activeSamplingId, handleSamplingSwitch],
  );

  const detectionSection = useMemo(
    () =>
      buildPluginSection({
        label: "Detection",
        pluginArray: config.detection,
        activeId: activeDetectionId,
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed due to contravariance in setConfig function parameter
        configRef: detectionConfigRef as any,
        onSwitchPlugin: handleDetectionSwitch,
      }),
    [config.detection, activeDetectionId, handleDetectionSwitch],
  );

  // Visualizer section (custom logic for non-plugin-selector UI)
  const visualizerSection = useMemo(() => {
    if (config.visualization.length === 0) return null;

    return {
      key: "visualizer",
      label: "Visualizer",
      icon: <Eye className="h-3.5 w-3.5" />,
      render: () => <VisualizerPanel visualizers={config.visualization} />,
    };
  }, [config.visualization]);

  // 6. Combine sections with minimal dependencies
  const sections = useMemo(() => {
    const result: SettingsPanelSection[] = [];

    if (sonificationSection) result.push(sonificationSection);
    if (samplingSection) result.push(samplingSection);
    if (detectionSection) result.push(detectionSection);
    if (visualizerSection) result.push(visualizerSection);

    return result;
  }, [sonificationSection, samplingSection, detectionSection, visualizerSection]);

  return sections;
};
