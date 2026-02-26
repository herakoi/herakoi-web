import type { VisualizationPluginDefinition } from "#src/core/plugin";
import { defineVisualizationPlugin } from "#src/core/plugin";
import { DebugHudDisplay } from "./components/DebugHudDisplay";
export const debugHudVisualizationPluginId = "visualization/debugHud" as const;

export const plugin: VisualizationPluginDefinition = defineVisualizationPlugin({
  id: debugHudVisualizationPluginId,
  displayName: "Debug HUD",
  ui: {
    VisualizerDisplay: DebugHudDisplay,
  },
});
