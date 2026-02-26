import { type ComponentType, useMemo, useRef } from "react";
import type { EngineConfig } from "#src/core/plugin";
import { usePluginConfig } from "../../state/appConfigStore";

type UsePluginSonificationPanelParams = {
  config: EngineConfig;
  activeSonificationId: string;
};

export const usePluginSonificationPanel = ({
  config,
  activeSonificationId,
}: UsePluginSonificationPanelParams): ComponentType | undefined => {
  const [sonificationConfig, setSonificationConfig] = usePluginConfig(activeSonificationId);

  const sonificationConfigRef = useRef({
    config: sonificationConfig,
    setConfig: setSonificationConfig,
  });
  sonificationConfigRef.current = {
    config: sonificationConfig,
    setConfig: setSonificationConfig,
  };

  const activeSonification = config.sonification.find((p) => p.id === activeSonificationId);

  const SonificationPanel = useMemo(() => {
    if (!activeSonification?.ui.SonificationPanel) return undefined;
    const PanelComponent = activeSonification.ui.SonificationPanel;

    const PanelWithConfig = () => {
      const { config, setConfig } = sonificationConfigRef.current;
      return <PanelComponent config={config as never} setConfig={setConfig} />;
    };

    return PanelWithConfig;
  }, [activeSonification]);

  return SonificationPanel;
};
