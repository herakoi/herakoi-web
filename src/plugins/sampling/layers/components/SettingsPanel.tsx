import type { PluginSettingsPanelProps } from "#src/core/plugin";
import { ImageLibrarySettings } from "#src/shared/image/components/ImageLibrarySettings";
import { type LayersSamplingConfig, layersSamplingPluginId } from "../config";
import { deleteLayersUpload, layersFileAccept, readLayersUpload } from "../lib/uploads";
import { useLayersRuntimeStore } from "../runtimeStore";
import { LayerMappingControls } from "./LayerMappingControls";

const errorNamespaces = [layersSamplingPluginId] as const;

export const LayersSettingsPanel = ({
  config,
  setConfig,
}: PluginSettingsPanelProps<LayersSamplingConfig>) => (
  <ImageLibrarySettings
    store={useLayersRuntimeStore}
    currentImageId={config.currentImageId}
    onSelectImage={(entry) => setConfig({ currentImageId: entry.id })}
    accept={layersFileAccept}
    readUpload={readLayersUpload}
    onDeleteUpload={deleteLayersUpload}
    errorNamespaces={errorNamespaces}
    renderImageControls={(entry) => (
      <LayerMappingControls entry={entry} config={config} setConfig={setConfig} />
    )}
  />
);
