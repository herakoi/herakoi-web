import type {
  PluginRuntimeContext,
  PluginUISlots,
  SamplerHandle,
  SamplingPluginDefinition,
} from "#src/core/plugin";
import { defineSamplingPlugin } from "#src/core/plugin";
import { loadImageElement } from "#src/shared/image/imageUtils";
import { createImageSamplerHandle } from "#src/shared/image/samplerHandle";
import { clearSampleChannels, publishSampleChannels } from "#src/shared/sampling/sampleChannels";
import { LayersSettingsPanel } from "./components/SettingsPanel";
import { LayersToolbarItems } from "./components/ToolbarItems";
import {
  defaultLayersSamplingConfig,
  type LayersSamplingConfig,
  layersSamplingPluginId,
} from "./config";
import { channelsForCube, LayerImageSampler } from "./LayerImageSampler";
// Registers the plugin's translations under its id.
import "./i18n";
import { imageToCube, type LayerCube } from "./lib/cube";
import { fitsIdFromSrc, loadFitsCube } from "./lib/fitsStore";
import { getDefaultImageId, resolveImageSourceById } from "./lib/imageSourceResolver";
import {
  isLayerMappingEqual,
  type LayerRender,
  renderLayers,
  sanitizeLayerMapping,
} from "./lib/render";
import { useLayersRuntimeStore } from "./runtimeStore";

const ui: PluginUISlots<LayersSamplingConfig> = {
  SettingsPanel: LayersSettingsPanel,
  ToolbarItems: LayersToolbarItems,
};

/** The loaded image: its layers and how they are currently rendered. */
type LayerBuffer = { imageId: string; cube: LayerCube; render: LayerRender };

const loadCube = async (src: string): Promise<LayerCube> => {
  const fitsId = fitsIdFromSrc(src);
  if (fitsId) return loadFitsCube(fitsId);
  return imageToCube(await loadImageElement(src));
};

export const plugin: SamplingPluginDefinition<typeof layersSamplingPluginId, LayersSamplingConfig> =
  defineSamplingPlugin({
    id: layersSamplingPluginId,
    displayName: "Layers & FITS",
    ui,
    config: {
      defaultConfig: defaultLayersSamplingConfig,
    },

    createSampler(
      _config: LayersSamplingConfig,
      runtime: PluginRuntimeContext<LayersSamplingConfig>,
    ): SamplerHandle {
      const sampler = new LayerImageSampler();
      let publishedCube: LayerCube | null = null;

      const mappingFor = (imageId: string, cube: LayerCube) =>
        sanitizeLayerMapping(runtime.getConfig().mappings?.[imageId], cube.layers.length);

      return createImageSamplerHandle<LayerBuffer>({
        sampler,
        store: useLayersRuntimeStore,
        label: "Layers sampling plugin",
        getCurrentImageId: () => runtime.getConfig().currentImageId,
        setCurrentImageId: (id) => runtime.setConfig({ currentImageId: id }),
        subscribeConfig: (listener) => runtime.subscribeConfig(listener),
        resolveImageSource: resolveImageSourceById,
        getDefaultImageId,
        loadBuffer: async (src, imageId) => {
          const cube = await loadCube(src);
          return { imageId, cube, render: renderLayers(cube, mappingFor(imageId, cube)) };
        },
        getDrawable: (buffer) => buffer.render.display,
        encode: (buffer, canvas, layout) => {
          sampler.setImage(buffer.cube, buffer.render);
          sampler.setView(layout.transform, canvas.width, canvas.height);
          if (publishedCube !== buffer.cube) {
            publishedCube = buffer.cube;
            publishSampleChannels(channelsForCube(buffer.cube));
          }
        },
        refreshBuffer: (buffer) => {
          const mapping = mappingFor(buffer.imageId, buffer.cube);
          if (isLayerMappingEqual(mapping, buffer.render.mapping)) return null;
          return { ...buffer, render: renderLayers(buffer.cube, mapping) };
        },
        onDispose: () => {
          publishedCube = null;
          clearSampleChannels();
        },
      });
    },
  });
