import { engineConfig } from "#src/engineConfig";

export type AppPluginConfigRegistry = Record<string, Record<string, unknown>>;

export type AppActivePlugins = {
  detection: string;
  sampling: string;
  sonification: string;
  visualization: string | null;
};

const runtimeConfigPlugins = [
  ...engineConfig.detection,
  ...engineConfig.sampling,
  ...engineConfig.sonification,
];

export const pluginConfigDefaults: AppPluginConfigRegistry = Object.fromEntries(
  runtimeConfigPlugins.map((plugin) => [plugin.id, plugin.config.defaultConfig]),
) as AppPluginConfigRegistry;

export const getDefaultActivePlugins = (): AppActivePlugins => {
  const preferTouch =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const touchDetection = engineConfig.detection.find((plugin) => plugin.preferredInput === "touch");

  return {
    detection: (preferTouch && touchDetection ? touchDetection : engineConfig.detection[0]).id,
    sampling: engineConfig.sampling[0].id,
    sonification: engineConfig.sonification[0].id,
    visualization: null,
  };
};
