import type { VisualizationPluginDefinition } from "#src/core/plugin";
import { defineVisualizationPlugin } from "#src/core/plugin";
import { DebugHudDisplay } from "./components/DebugHudDisplay";
import { debugHudVisualizationPluginId } from "./config";
import "./i18n";

export { debugHudVisualizationPluginId };

export const plugin: VisualizationPluginDefinition = defineVisualizationPlugin({
  id: debugHudVisualizationPluginId,
  displayName: "Debug HUD",
  ui: {
    VisualizerDisplay: DebugHudDisplay,
  },
});
