/**
 * Plugin type system for the Herakoi pipeline.
 *
 * Each pipeline stage (detection, sampling, sonification) can be implemented
 * as a self-contained plugin that bundles:
 * - A pipeline implementation (conforming to core interfaces)
 * - React UI components (settings panel, dock panel, toolbar items)
 * - Plugin-local state management (own Zustand store)
 *
 * Plugins are composed at compile-time in a PipelineConfig and the shell
 * renders their UI into designated slots. Multiple plugins per slot enables
 * runtime switching via a PluginSelector dropdown.
 */

import type { ComponentType, ReactNode, RefObject } from "react";
import type { ImageSampler, PointDetector, Sonifier } from "#src/core/interfaces";

// ──────────────────────────────────────────────────
// Shared UI slot types
// ──────────────────────────────────────────────────

/** Props the shell passes directly to the DockPanel wrapper. */
export type ShellDockPanelProps = {
  /** Whether the pipeline is currently running */
  isRunning: boolean;
  /** Whether the pipeline is initializing */
  isInitializing: boolean;
  /** Start the pipeline */
  onStart: () => void;
  /** Stop the pipeline */
  onStop: () => void;
};

/** Full props a plugin's DockPanel receives (shell props + plugin config). */
export type DockPanelProps<TConfig = unknown> = ShellDockPanelProps & {
  /** Current plugin configuration */
  config: TConfig;
  /** Update plugin configuration (partial updates) */
  setConfig: (updates: Partial<TConfig>) => void;
};

/**
 * Props passed to plugin settings panels.
 * Generic over the plugin's config type.
 */
export type PluginSettingsPanelProps<TConfig> = {
  /** Current plugin configuration */
  config: TConfig;
  /** Update plugin configuration (partial updates) */
  setConfig: (updates: Partial<TConfig>) => void;
};

/**
 * Rendering slots the shell provides to each plugin.
 * All slots are optional — a plugin only fills the ones it needs.
 * Generic over the plugin's config type for SettingsPanel and ToolbarItems.
 */
export type PluginUISlots<TConfig> = {
  /** Content rendered inside a tab in the settings popover */
  SettingsPanel?: ComponentType<PluginSettingsPanelProps<TConfig>>;
  /** Floating dock content (e.g., camera PiP window) */
  DockPanel?: ComponentType<DockPanelProps<TConfig>>;
  /** Optional items rendered in the header toolbar area */
  ToolbarItems?: ComponentType<PluginSettingsPanelProps<TConfig>>;
};

/** Metadata for a settings panel tab. */
export type PluginTabMeta = {
  /** Unique key for the tab */
  key: string;
  /** Display label */
  label: string;
  /** Icon element (e.g., lucide-react icon) */
  icon: ReactNode;
};

export type PluginConfigSpec<TConfig> = {
  /** Default configuration used for reset and first run. */
  defaultConfig: TConfig;
};

// ──────────────────────────────────────────────────
// Notification system
// ──────────────────────────────────────────────────

export type NotificationData = {
  message: string;
  icon?: ComponentType<{ className?: string }>;
  screenReaderMessage?: string;
  politeness?: "polite" | "assertive";
};

export type PipelineCallbacks = {
  showNotification: (id: string, data: NotificationData) => void;
  hideNotification: (id: string) => void;
};

// ──────────────────────────────────────────────────
// Detection plugin
// ──────────────────────────────────────────────────

/** Handle returned by a detection plugin's factory. */
export type DetectorHandle = {
  detector: PointDetector;
  /**
   * Optional setup that runs after detector.initialize().
   * For MediaPipe this binds hand overlays; for mouse this is a no-op.
   */
  postInitialize?: () => void;
  /** Optional cleanup when the pipeline stops. */
  cleanup?: () => void;
  /**
   * Optional method to receive canvas refs from the shell.
   * Called before postInitialize so plugins can register refs internally.
   */
  setCanvasRefs?: (refs: { imageOverlay?: RefObject<HTMLCanvasElement> }) => void;
};

export interface DetectionPlugin<TPluginId extends string = string, TConfig = any> {
  readonly kind: "detection";
  readonly id: TPluginId;
  readonly displayName: string;
  /** Tab metadata for the settings panel (null = no settings tab) */
  readonly settingsTab: PluginTabMeta | null;
  /** UI components this plugin contributes */
  readonly ui: PluginUISlots<TConfig>;
  /** Default config and configuration metadata for this plugin. */
  readonly config: PluginConfigSpec<TConfig>;

  /** Create the PointDetector instance from provided configuration. */
  createDetector(config: TConfig): DetectorHandle;

  /**
   * Subscribe to pipeline-relevant events from the detector.
   * The shell passes notification callbacks so plugins can show prompts
   * without importing shell stores.
   */
  bindPipelineEvents(detector: PointDetector, callbacks: PipelineCallbacks): void;
}

// ──────────────────────────────────────────────────
// Sampling plugin
// ──────────────────────────────────────────────────

/** Handle returned by a sampling plugin's factory. */
export type SamplerHandle = {
  sampler: ImageSampler;
  /** Optional implementation-specific extras (currently unused). */
  extras?: Record<string, unknown>;
  /**
   * Optional setup that runs after sampler creation.
   * For HSV this restores the persisted image and draws it to canvas.
   */
  postInitialize?: () => Promise<void>;
  /** Optional cleanup when the pipeline stops. */
  cleanup?: () => void;
  /**
   * Optional method to receive canvas refs from the shell.
   * Called before postInitialize so plugins can register refs internally.
   */
  setCanvasRefs?: (refs: { imageCanvas: RefObject<HTMLCanvasElement> }) => void;
};

export interface SamplingPlugin<TPluginId extends string = string, TConfig = any> {
  readonly kind: "sampling";
  readonly id: TPluginId;
  readonly displayName: string;
  readonly settingsTab: PluginTabMeta | null;
  readonly ui: PluginUISlots<TConfig>;
  /** Default config and configuration metadata for this plugin. */
  readonly config: PluginConfigSpec<TConfig>;

  /** Create the ImageSampler instance from provided configuration. */
  createSampler(config: TConfig): SamplerHandle;
}

// ──────────────────────────────────────────────────
// Sonification plugin
// ──────────────────────────────────────────────────

/** Handle returned by a sonification plugin's factory. */
export type SonifierHandle = {
  sonifier: Sonifier;
  /** Expose implementation-specific extras (e.g., AnalyserNode). */
  extras?: Record<string, unknown>;
  /** Optional cleanup when the pipeline stops. */
  cleanup?: () => void;
};

export interface SonificationPlugin<TPluginId extends string = string, TConfig = any> {
  readonly kind: "sonification";
  readonly id: TPluginId;
  readonly displayName: string;
  readonly settingsTab: PluginTabMeta | null;
  readonly ui: PluginUISlots<TConfig>;
  /** Default config and configuration metadata for this plugin. */
  readonly config: PluginConfigSpec<TConfig>;

  /** Create the Sonifier instance from provided configuration. */
  createSonifier(config: TConfig): SonifierHandle;
}

// ──────────────────────────────────────────────────
// Visualization plugin
// ──────────────────────────────────────────────────

/**
 * Frame data passed to visualizers from all pipeline stages.
 * Updated each frame via ref to avoid React re-renders.
 */
export type VisualizerFrameData = {
  detection: {
    points: Array<{ id: string; x: number; y: number }>;
    handDetected: boolean;
  };
  sampling: {
    samples: Map<string, { data: Record<string, number> }>;
  };
  sonification: {
    tones: Map<
      string,
      {
        frequency: number;
        volume: number;
        hueByte: number;
        saturationByte: number;
        valueByte: number;
      }
    >;
  };
  analyser: AnalyserNode | null;
};

/** Props passed to a visualizer display component. */
export type VisualizerDisplayProps = {
  /** Whether the pipeline is currently running */
  isRunning: boolean;
  /** Ref to frame data updated each frame (read-only) */
  frameDataRef: RefObject<VisualizerFrameData>;
};

export interface VisualizationPlugin {
  readonly kind: "visualization";
  readonly id: string;
  readonly displayName: string;
  /** Tab metadata for the settings panel (null = no settings tab) */
  readonly settingsTab: PluginTabMeta | null;
  /** UI components this plugin contributes */
  readonly ui: {
    /** Main visualizer display component */
    VisualizerDisplay?: ComponentType<VisualizerDisplayProps>;
    /** Settings panel (if visualization needs configuration) */
    SettingsPanel?: ComponentType;
    /** Optional toolbar items */
    ToolbarItems?: ComponentType;
  };
}

// ──────────────────────────────────────────────────
// Pipeline configuration
// ──────────────────────────────────────────────────

/**
 * Declares all available plugins per pipeline slot.
 *
 * Each slot holds an array of plugins. The shell manages which plugin
 * is active per slot (persisted in appConfigStore). When only one plugin
 * is available the selector is hidden.
 *
 * Visualization plugins are optional and can be enabled/disabled via
 * settings UI. Only one visualizer can be active at a time.
 */
export type PipelineConfig = {
  detection: readonly DetectionPlugin<string, any>[];
  sampling: readonly SamplingPlugin<string, any>[];
  sonification: readonly SonificationPlugin<string, any>[];
  visualization: readonly VisualizationPlugin[];
};

type ConfigurablePlugin = DetectionPlugin | SamplingPlugin | SonificationPlugin;

type ConfigurablePluginsFrom<TConfig extends PipelineConfig> =
  | TConfig["detection"][number]
  | TConfig["sampling"][number]
  | TConfig["sonification"][number];

export type InferPluginConfigRegistry<TConfig extends PipelineConfig> = {
  [P in ConfigurablePluginsFrom<TConfig> as P["id"]]: P extends ConfigurablePlugin
    ? P extends { config: PluginConfigSpec<infer TPluginConfig> }
      ? TPluginConfig
      : never
    : never;
};

export type InferActivePlugins<TConfig extends PipelineConfig> = {
  detection: TConfig["detection"][number]["id"];
  sampling: TConfig["sampling"][number]["id"];
  sonification: TConfig["sonification"][number]["id"];
  visualization: TConfig["visualization"][number]["id"] | null;
};

/** Build default plugin config registry from the composed pipeline. */
export const buildPluginConfigDefaults = <TConfig extends PipelineConfig>(
  pipelineConfig: TConfig,
): InferPluginConfigRegistry<TConfig> => {
  const defaults: Record<string, unknown> = {};
  const configurablePlugins: ConfigurablePlugin[] = [
    ...pipelineConfig.detection,
    ...pipelineConfig.sampling,
    ...pipelineConfig.sonification,
  ];

  for (const plugin of configurablePlugins) {
    defaults[plugin.id] = structuredClone(plugin.config.defaultConfig);
  }

  return defaults as InferPluginConfigRegistry<TConfig>;
};
