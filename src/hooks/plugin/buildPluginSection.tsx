import type { ComponentType, MutableRefObject } from "react";
import { PluginSelector } from "../../components/PluginSelector";
import type { SettingsPanelSection } from "../../components/SettingsPanel";

/**
 * Helper function to build a settings panel section for a plugin.
 * Uses a ref-based pattern to keep config values fresh while maintaining stable section identity.
 * This prevents unnecessary section rebuilds when config changes.
 */
type BuildPluginSectionParams<TPlugin> = {
  tab: Pick<SettingsPanelSection, "key" | "label" | "icon">;
  label: string;
  pluginArray: readonly TPlugin[];
  activeId: string;
  configRef: MutableRefObject<{ config: unknown; setConfig: (updates: unknown) => void }>;
  onSwitchPlugin: (id: string) => void;
};

export function buildPluginSection<
  TPlugin extends {
    id: string;
    displayName: string;
    // biome-ignore lint/suspicious/noExplicitAny: Generic constraint requires any to accept all plugin SettingsPanel types
    ui: { SettingsPanel?: ComponentType<any> };
  },
>(params: BuildPluginSectionParams<TPlugin>): SettingsPanelSection | null {
  const { tab, label, pluginArray, activeId, configRef, onSwitchPlugin } = params;

  const activePlugin = pluginArray.find((p) => p.id === activeId);
  if (!activePlugin) {
    return null;
  }

  const Panel = activePlugin.ui.SettingsPanel;

  return {
    key: tab.key,
    label: tab.label,
    icon: tab.icon,
    render: () => {
      // Read from ref so values stay fresh while section object remains stable
      // Type assertion is safe: activePluginId guarantees config type matches Panel's expectations
      // biome-ignore lint/style/noNonNullAssertion: Ref is guaranteed to be initialized before render
      const { config, setConfig } = configRef.current!;
      return (
        <>
          <PluginSelector
            label={label}
            plugins={pluginArray.map((p) => ({
              id: p.id,
              displayName: p.displayName,
            }))}
            activeId={activeId}
            onSelect={onSwitchPlugin}
          />
          {Panel ? <Panel config={config as never} setConfig={setConfig} /> : null}
        </>
      );
    },
  };
}
