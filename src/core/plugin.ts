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

import type { ComponentType, ReactNode } from "react";
import type { ImageSampler, PointDetector, Sonifier } from "#src/core/interfaces";

// ──────────────────────────────────────────────────
// Shared UI slot types
// ──────────────────────────────────────────────────

/** Props the shell passes to a plugin's dock panel. */
export type DockPanelProps = {
  /** Whether the pipeline is currently running */
  isRunning: boolean;
  /** Whether the pipeline is initializing */
  isInitializing: boolean;
  /** Start the pipeline */
  onStart: () => void;
  /** Stop the pipeline */
  onStop: () => void;
  /** Set UI opacity (0 = fully dimmed, 1 = fully visible) */
  setUiOpacity: (opacity: number) => void;
};

/**
 * Rendering slots the shell provides to each plugin.
 * All slots are optional — a plugin only fills the ones it needs.
 */
export type PluginUISlots = {
  /** Content rendered inside a tab in the settings popover */
  SettingsPanel?: ComponentType;
  /** Floating dock content (e.g., camera PiP window) */
  DockPanel?: ComponentType<DockPanelProps>;
  /** Optional items rendered in the header toolbar area */
  ToolbarItems?: ComponentType;
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
};

export interface DetectionPlugin {
  readonly kind: "detection";
  readonly id: string;
  readonly displayName: string;
  /** Tab metadata for the settings panel (null = no settings tab) */
  readonly settingsTab: PluginTabMeta | null;
  /** UI components this plugin contributes */
  readonly ui: PluginUISlots;

  /** Create the PointDetector instance from current plugin state. */
  createDetector(): DetectorHandle;

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
};

export interface SamplingPlugin {
  readonly kind: "sampling";
  readonly id: string;
  readonly displayName: string;
  readonly settingsTab: PluginTabMeta | null;
  readonly ui: PluginUISlots;

  /** Create the ImageSampler instance. */
  createSampler(): SamplerHandle;
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

export interface SonificationPlugin {
  readonly kind: "sonification";
  readonly id: string;
  readonly displayName: string;
  readonly settingsTab: PluginTabMeta | null;
  readonly ui: PluginUISlots;

  /** Create the Sonifier instance from current plugin state. */
  createSonifier(): SonifierHandle;
}

// ──────────────────────────────────────────────────
// Pipeline configuration
// ──────────────────────────────────────────────────

/**
 * Declares all available plugins per pipeline slot.
 *
 * Each slot holds an array of plugins. The shell manages which plugin
 * is active per slot (persisted in pipelineStore). When only one plugin
 * is available the selector is hidden.
 */
export type PipelineConfig = {
  detection: DetectionPlugin[];
  sampling: SamplingPlugin[];
  sonification: SonificationPlugin[];
};
