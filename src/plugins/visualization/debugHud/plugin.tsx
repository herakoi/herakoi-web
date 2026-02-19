import { Bug } from "lucide-react";
import type { PluginTabMeta, VisualizationPluginDefinition } from "#src/core/plugin";
import { defineVisualizationPlugin } from "#src/core/plugin";
import { DebugHudDisplay } from "./components/DebugHudDisplay";
export const debugHudVisualizationPluginId = "visualization/debugHud" as const;

const settingsTab: PluginTabMeta = {
  key: "debug-hud",
  label: "Debug HUD",
  icon: <Bug className="h-3.5 w-3.5" />,
};

export const plugin: VisualizationPluginDefinition = defineVisualizationPlugin({
  id: debugHudVisualizationPluginId,
  displayName: "Debug HUD",
  settingsTab,
  ui: {
    VisualizerDisplay: DebugHudDisplay,
  },
});
