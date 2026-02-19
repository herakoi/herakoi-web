import type {
  DetectionPlugin,
  DetectionPluginDefinition,
  EngineConfig,
  RuntimePlugin,
  SamplingPlugin,
  SamplingPluginDefinition,
  SonificationPlugin,
  SonificationPluginDefinition,
  VisualizationPlugin,
  VisualizationPluginDefinition,
} from "#src/core/plugin";

type PluginModule = {
  plugin?: unknown;
};

const pluginModules = {
  ...import.meta.glob("./plugins/**/plugin.ts", { eager: true }),
  ...import.meta.glob("./plugins/**/plugin.tsx", { eager: true }),
} as Record<string, PluginModule>;

const CORE_SLOTS = ["detection", "sampling", "sonification"] as const;
type CoreSlot = (typeof CORE_SLOTS)[number];

const isRuntimePlugin = (value: unknown): value is RuntimePlugin => {
  if (!value || typeof value !== "object") return false;
  const plugin = value as Partial<RuntimePlugin>;
  return (
    typeof plugin.id === "string" &&
    typeof plugin.displayName === "string" &&
    (plugin.kind === "detection" ||
      plugin.kind === "sampling" ||
      plugin.kind === "sonification" ||
      plugin.kind === "visualization")
  );
};

const isDetectionPluginDefinition = (value: unknown): value is DetectionPluginDefinition => {
  if (!value || typeof value !== "object") return false;
  const plugin = value as Partial<DetectionPluginDefinition>;
  return (
    typeof plugin.id === "string" &&
    typeof plugin.displayName === "string" &&
    typeof plugin.createDetector === "function" &&
    typeof plugin.bindPipelineEvents === "function" &&
    typeof plugin.config === "object" &&
    plugin.config !== null &&
    "defaultConfig" in plugin.config
  );
};

const isSamplingPluginDefinition = (value: unknown): value is SamplingPluginDefinition => {
  if (!value || typeof value !== "object") return false;
  const plugin = value as Partial<SamplingPluginDefinition>;
  return (
    typeof plugin.id === "string" &&
    typeof plugin.displayName === "string" &&
    typeof plugin.createSampler === "function" &&
    typeof plugin.config === "object" &&
    plugin.config !== null &&
    "defaultConfig" in plugin.config
  );
};

const isSonificationPluginDefinition = (value: unknown): value is SonificationPluginDefinition => {
  if (!value || typeof value !== "object") return false;
  const plugin = value as Partial<SonificationPluginDefinition>;
  return (
    typeof plugin.id === "string" &&
    typeof plugin.displayName === "string" &&
    typeof plugin.createSonifier === "function" &&
    typeof plugin.config === "object" &&
    plugin.config !== null &&
    "defaultConfig" in plugin.config
  );
};

const isVisualizationPluginDefinition = (
  value: unknown,
): value is VisualizationPluginDefinition => {
  if (!value || typeof value !== "object") return false;
  const plugin = value as Partial<VisualizationPluginDefinition>;
  return typeof plugin.id === "string" && typeof plugin.displayName === "string";
};

const derivePluginIdFromPath = (modulePath: string): string => {
  return modulePath.replace(/^\.\/plugins\//, "").replace(/\/plugin\.(ts|tsx)$/, "");
};

const derivePluginKindFromPath = (modulePath: string): RuntimePlugin["kind"] => {
  const id = derivePluginIdFromPath(modulePath);
  const slot = id.split("/")[0];
  if (
    slot !== "detection" &&
    slot !== "sampling" &&
    slot !== "sonification" &&
    slot !== "visualization"
  ) {
    throw new Error(
      `[engine-config] Invalid plugin path "${modulePath}". Expected ./plugins/<kind>/<name>/plugin.tsx.`,
    );
  }
  return slot;
};

const sortById = <T extends { id: string }>(plugins: readonly T[]): T[] =>
  [...plugins].sort((a, b) => a.id.localeCompare(b.id));

const discoveredPlugins = Object.entries(pluginModules).map(([modulePath, module]) => {
  if (!module.plugin) {
    throw new Error(
      `[engine-config] Missing canonical export "plugin" in ${modulePath}. Use: export const plugin = definePlugin(...).`,
    );
  }

  const expectedId = derivePluginIdFromPath(modulePath);
  const expectedKind = derivePluginKindFromPath(modulePath);

  if (!(isRuntimePlugin(module.plugin) || typeof module.plugin === "object")) {
    throw new Error(`[engine-config] Invalid plugin contract in ${modulePath}.`);
  }

  const hasExpectedType =
    (expectedKind === "detection" && isDetectionPluginDefinition(module.plugin)) ||
    (expectedKind === "sampling" && isSamplingPluginDefinition(module.plugin)) ||
    (expectedKind === "sonification" && isSonificationPluginDefinition(module.plugin)) ||
    (expectedKind === "visualization" && isVisualizationPluginDefinition(module.plugin));

  if (!hasExpectedType) {
    throw new Error(
      `[engine-config] Plugin type mismatch in ${modulePath}. Export type is not valid for "${expectedKind}".`,
    );
  }

  const pluginWithKind = {
    ...(module.plugin as Omit<RuntimePlugin, "kind">),
    kind: expectedKind,
  } as RuntimePlugin;

  if (pluginWithKind.id !== expectedId) {
    throw new Error(
      `[engine-config] Plugin id mismatch in ${modulePath}. Expected "${expectedId}" from path.`,
    );
  }

  return pluginWithKind;
});

const idSet = new Set<string>();
for (const plugin of discoveredPlugins) {
  if (idSet.has(plugin.id)) {
    throw new Error(`[engine-config] Duplicate plugin id "${plugin.id}" detected.`);
  }
  idSet.add(plugin.id);
}

const detection = sortById(
  discoveredPlugins.filter((plugin): plugin is DetectionPlugin<string, object> => {
    return plugin.kind === "detection";
  }),
);
const sampling = sortById(
  discoveredPlugins.filter((plugin): plugin is SamplingPlugin<string, object> => {
    return plugin.kind === "sampling";
  }),
);
const sonification = sortById(
  discoveredPlugins.filter((plugin): plugin is SonificationPlugin<string, object> => {
    return plugin.kind === "sonification";
  }),
);
const visualization = sortById(
  discoveredPlugins.filter((plugin): plugin is VisualizationPlugin => {
    return plugin.kind === "visualization";
  }),
);

const coreCounts: Record<CoreSlot, number> = {
  detection: detection.length,
  sampling: sampling.length,
  sonification: sonification.length,
};

for (const slot of CORE_SLOTS) {
  if (coreCounts[slot] === 0) {
    throw new Error(`[engine-config] Missing required plugin slot "${slot}".`);
  }
}

export const engineConfig = {
  detection,
  sampling,
  sonification,
  visualization,
} as const satisfies EngineConfig;
