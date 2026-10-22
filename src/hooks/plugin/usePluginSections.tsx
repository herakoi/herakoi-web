import { Eye, Image, Pointer, Volume2 } from "lucide-react";
import { useMemo, useRef } from "react";
import type { EngineConfig } from "#src/core/plugin";
import { VisualizerPanel } from "../../components/panels/VisualizerPanel";
import type { SettingsPanelSection } from "../../components/SettingsPanel";
import { useActivePlugin, usePluginConfig } from "../../state/appConfigStore";
import { buildPluginSection } from "./buildPluginSection";
import { usePluginSwitch } from "./usePluginSwitch";

type UsePluginSectionsParams = {
  config: EngineConfig;
  stopTransport: () => void;
};

export const usePluginSections = ({
  config,
  stopTransport,
}: UsePluginSectionsParams): SettingsPanelSection[] => {
  // 1. Subscribe to active plugin IDs and setters from store
  const [activeDetectionId] = useActivePlugin("detection");
  const [activeSamplingId] = useActivePlugin("sampling");
  const [activeSonificationId] = useActivePlugin("sonification");

  // 2. Get plugin configs at top level (hooks must be called unconditionally)
  const [sonificationConfig, setSonificationConfig] = usePluginConfig(activeSonificationId);
  const [samplingConfig, setSamplingConfig] = usePluginConfig(activeSamplingId);
  const [detectionConfig, setDetectionConfig] = usePluginConfig(activeDetectionId);

  // 3. Create individual plugin switch handlers (stop transport → switch plugin → auto-start)
  const transport = { stopTransport };
  const handleSonificationSwitch = usePluginSwitch("sonification", transport);
  const handleSamplingSwitch = usePluginSwitch("sampling", transport);
  const handleDetectionSwitch = usePluginSwitch("detection", transport);

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
        tab: {
          key: "audio",
          label: "Audio",
          icon: <Volume2 className="h-3.5 w-3.5" />,
        },
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
        tab: {
          key: "sample",
          label: "Sample",
          icon: <Image className="h-3.5 w-3.5" />,
        },
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
        tab: {
          key: "input",
          label: "Input",
          icon: <Pointer className="h-3.5 w-3.5" />,
        },
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

    if (detectionSection) result.push(detectionSection);
    if (samplingSection) result.push(samplingSection);
    if (sonificationSection) result.push(sonificationSection);
    if (visualizerSection) result.push(visualizerSection);

    return result;
  }, [sonificationSection, samplingSection, detectionSection, visualizerSection]);

  return sections;
};
