import type { PluginSettingsPanelProps } from "#src/core/plugin";
import { ImageLibrarySettings } from "#src/shared/image/components/ImageLibrarySettings";
import { type HSVSamplingConfig, hsvSamplingPluginId } from "../config";
import { useHSVRuntimeStore } from "../runtimeStore";

const errorNamespaces = [hsvSamplingPluginId] as const;

export const HSVSettingsPanel = ({
  config,
  setConfig,
}: PluginSettingsPanelProps<HSVSamplingConfig>) => (
  <ImageLibrarySettings
    store={useHSVRuntimeStore}
    currentImageId={config.currentImageId}
    onSelectImage={(entry) => setConfig({ currentImageId: entry.id })}
    errorNamespaces={errorNamespaces}
  />
);
