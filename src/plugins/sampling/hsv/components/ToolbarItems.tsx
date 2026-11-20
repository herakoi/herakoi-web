import type { PluginSettingsPanelProps } from "#src/core/plugin";
import { ImageToolbar } from "#src/shared/image/components/ImageToolbar";
import { type HSVSamplingConfig, hsvSamplingPluginId } from "../config";
import { useHSVRuntimeStore } from "../runtimeStore";

const errorNamespaces = [hsvSamplingPluginId] as const;

export const HSVToolbarItems = ({
  config,
  setConfig,
}: PluginSettingsPanelProps<HSVSamplingConfig>) => (
  <ImageToolbar
    store={useHSVRuntimeStore}
    currentImageId={config.currentImageId}
    onSelectImage={(entry) => setConfig({ currentImageId: entry.id })}
    errorNamespaces={errorNamespaces}
  />
);
