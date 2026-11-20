import type { PluginSettingsPanelProps } from "#src/core/plugin";
import { ImageToolbar } from "#src/shared/image/components/ImageToolbar";
import { type LayersSamplingConfig, layersSamplingPluginId } from "../config";
import { deleteLayersUpload, layersFileAccept, readLayersUpload } from "../lib/uploads";
import { useLayersRuntimeStore } from "../runtimeStore";

const errorNamespaces = [layersSamplingPluginId] as const;

export const LayersToolbarItems = ({
  config,
  setConfig,
}: PluginSettingsPanelProps<LayersSamplingConfig>) => (
  <ImageToolbar
    store={useLayersRuntimeStore}
    currentImageId={config.currentImageId}
    onSelectImage={(entry) => setConfig({ currentImageId: entry.id })}
    accept={layersFileAccept}
    readUpload={readLayersUpload}
    onDeleteUpload={deleteLayersUpload}
    errorNamespaces={errorNamespaces}
  />
);
