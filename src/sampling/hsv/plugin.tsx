import { Image as ImageIcon } from "lucide-react";
import type { PluginTabMeta, PluginUISlots, SamplerHandle, SamplingPlugin } from "#src/core/plugin";
import { HSVImageSampler } from "./HSVImageSampler";

const settingsTab: PluginTabMeta = {
  key: "image",
  label: "Image",
  icon: <ImageIcon className="h-3.5 w-3.5" />,
};

// Stub: For now the settings panel is rendered directly in App.tsx with ImagePanel
// In a full extraction, this plugin would own the image library logic and the
// settings panel would be self-contained. For now we don't provide a SettingsPanel
// component to avoid type conflicts - App.tsx handles it.
const ui: PluginUISlots = {
  // SettingsPanel will be added when image management is extracted to plugin
};

export const hsvSamplingPlugin: SamplingPlugin = {
  kind: "sampling",
  id: "hsv-color",
  displayName: "HSV Color",
  settingsTab,
  ui,

  createSampler(): SamplerHandle {
    return {
      sampler: new HSVImageSampler(),
    };
  },
};
