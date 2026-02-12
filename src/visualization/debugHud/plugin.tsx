import { Bug } from "lucide-react";
import type { PluginTabMeta, VisualizationPlugin } from "#src/core/plugin";
import { DebugHudDisplay } from "./components/DebugHudDisplay";

const settingsTab: PluginTabMeta = {
  key: "debug-hud",
  label: "Debug HUD",
  icon: <Bug className="h-3.5 w-3.5" />,
};

export const debugHudVisualizationPlugin: VisualizationPlugin = {
  kind: "visualization",
  id: "debug-hud",
  displayName: "Debug HUD",
  settingsTab,
  ui: {
    VisualizerDisplay: DebugHudDisplay,
  },
};
