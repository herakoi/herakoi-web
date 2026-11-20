import type {
  PluginRuntimeContext,
  PluginUISlots,
  SamplerHandle,
  SamplingPluginDefinition,
} from "#src/core/plugin";
import { defineSamplingPlugin } from "#src/core/plugin";
import { loadImageElement } from "#src/shared/image/imageUtils";
import { createImageSamplerHandle } from "#src/shared/image/samplerHandle";
import { HSVSettingsPanel } from "./components/SettingsPanel";
import { HSVToolbarItems } from "./components/ToolbarItems";
import { defaultHSVSamplingConfig, type HSVSamplingConfig, hsvSamplingPluginId } from "./config";
import { HSVImageSampler } from "./HSVImageSampler";
// Registers the plugin's translations under its id.
import "./i18n";
import { getDefaultImageId, resolveImageSourceById } from "./lib/imageSourceResolver";
import { useHSVRuntimeStore } from "./runtimeStore";

const ui: PluginUISlots<HSVSamplingConfig> = {
  SettingsPanel: HSVSettingsPanel,
  ToolbarItems: HSVToolbarItems,
};

export const plugin: SamplingPluginDefinition<typeof hsvSamplingPluginId, HSVSamplingConfig> =
  defineSamplingPlugin({
    id: hsvSamplingPluginId,
    displayName: "HSV Color",
    ui,
    config: {
      defaultConfig: defaultHSVSamplingConfig,
    },

    createSampler(
      _config: HSVSamplingConfig,
      runtime: PluginRuntimeContext<HSVSamplingConfig>,
    ): SamplerHandle {
      const sampler = new HSVImageSampler();
      return createImageSamplerHandle<HTMLImageElement>({
        sampler,
        store: useHSVRuntimeStore,
        label: "HSV sampling plugin",
        getCurrentImageId: () => runtime.getConfig().currentImageId,
        setCurrentImageId: (id) => runtime.setConfig({ currentImageId: id }),
        subscribeConfig: (listener) => runtime.subscribeConfig(listener),
        resolveImageSource: resolveImageSourceById,
        getDefaultImageId,
        loadBuffer: loadImageElement,
        getDrawable: (image) => image,
        // The canvas holds exactly what is shown; the sampler encodes it as HSV.
        encode: (_image, canvas) => sampler.loadImage(canvas),
      });
    },
  });
