/**
 * Central application configuration store.
 *
 * Manages all persisted user preferences including:
 * - Active plugin selections per slot
 * - Plugin-specific configurations
 * - Shell UI preferences
 *
 * This store is the single source of truth for what users want saved across
 * sessions. It enables trivial export/import and centralized reset.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  type AppActivePlugins,
  type AppPluginConfigRegistry,
  pluginConfigDefaults,
} from "../pluginConfigRegistry";
import { APP_CONFIG_KEY } from "./persistenceKeys";

// ──────────────────────────────────────────────────
// Type Definitions
// ──────────────────────────────────────────────────

export type PipelineSlot = "detection" | "sampling" | "sonification" | "visualization";

/**
 * Active plugin selections for each pipeline slot.
 * Keys are slot names, values are plugin IDs inferred from pipelineConfig.
 */
export type ActivePlugins = AppActivePlugins;

/**
 * Shell UI preferences (not plugin-specific).
 */
export interface UiPreferences {
  /** Base UI opacity (0-1), user's preferred setting */
  baseUiOpacity: number;
  /** Whether to dim the logo mark when hands detected */
  dimLogoMark: boolean;
}

/**
 * Complete application configuration state.
 */
export interface AppConfigState {
  activePlugins: ActivePlugins;
  pluginConfigs: AppPluginConfigRegistry;
  uiPreferences: UiPreferences;
}

/**
 * Actions for modifying app configuration.
 */
export interface AppConfigActions {
  /** Set which plugin is active for a given slot */
  setActivePlugin: <K extends keyof ActivePlugins>(slot: K, pluginId: ActivePlugins[K]) => void;

  /** Update configuration for a specific plugin */
  setPluginConfig: <K extends keyof AppPluginConfigRegistry>(
    pluginId: K,
    updates: Partial<AppPluginConfigRegistry[K]>,
  ) => void;

  /** Update shell UI preferences */
  setUiPreferences: (updates: Partial<UiPreferences>) => void;

  /** Reset all configuration to defaults */
  resetAll: () => void;

  /** Export entire config as JSON string */
  exportConfig: () => string;

  /** Import config from JSON string */
  importConfig: (json: string) => void;
}

// ──────────────────────────────────────────────────
// Default Configuration
// ──────────────────────────────────────────────────

const defaultActivePlugins: ActivePlugins = {
  detection: "detection/mediapipe",
  sampling: "sampling/hsv",
  sonification: "sonification/oscillator",
  visualization: null,
};

const defaultUiPreferences: UiPreferences = {
  baseUiOpacity: 1,
  dimLogoMark: false,
};

const defaultConfig: AppConfigState = {
  activePlugins: defaultActivePlugins,
  pluginConfigs: pluginConfigDefaults,
  uiPreferences: defaultUiPreferences,
};

// ──────────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────────

const configStorage =
  typeof window === "undefined" ? undefined : createJSONStorage(() => localStorage);

export const useAppConfigStore = create<AppConfigState & AppConfigActions>()(
  persist(
    (set, get) => ({
      ...defaultConfig,

      setActivePlugin: (slot, pluginId) => {
        set((state) => ({
          activePlugins: {
            ...state.activePlugins,
            [slot]: pluginId,
          },
        }));
      },

      setPluginConfig: (pluginId, updates) => {
        set((state) => ({
          pluginConfigs: {
            ...state.pluginConfigs,
            [pluginId]: {
              ...state.pluginConfigs[pluginId],
              ...updates,
            },
          },
        }));
      },

      setUiPreferences: (updates) => {
        set((state) => ({
          uiPreferences: {
            ...state.uiPreferences,
            ...updates,
          },
        }));
      },

      resetAll: () => {
        set(defaultConfig);
      },

      exportConfig: () => {
        const state = get();
        return JSON.stringify(
          {
            activePlugins: state.activePlugins,
            pluginConfigs: state.pluginConfigs,
            uiPreferences: state.uiPreferences,
          },
          null,
          2,
        );
      },

      importConfig: (json) => {
        try {
          const imported = JSON.parse(json) as Partial<AppConfigState>;

          // Deep merge plugin configs (each plugin config needs individual merging)
          const mergedPluginConfigs = { ...pluginConfigDefaults };
          if (imported.pluginConfigs) {
            for (const key in imported.pluginConfigs) {
              const pluginId = key as keyof AppPluginConfigRegistry;
              // Type assertion is safe: we're merging defaults with imported config for the same plugin ID
              // biome-ignore lint/suspicious/noExplicitAny: Type narrowing not possible with union types
              (mergedPluginConfigs as any)[pluginId] = {
                ...pluginConfigDefaults[pluginId],
                ...imported.pluginConfigs[pluginId],
              };
            }
          }

          set({
            activePlugins: {
              ...defaultActivePlugins,
              ...imported.activePlugins,
            },
            pluginConfigs: mergedPluginConfigs,
            uiPreferences: {
              ...defaultUiPreferences,
              ...imported.uiPreferences,
            },
          });
        } catch (error) {
          console.error("Failed to import config:", error);
          throw new Error("Invalid configuration JSON");
        }
      },
    }),
    {
      name: APP_CONFIG_KEY,
      storage: configStorage,
    },
  ),
);

// ──────────────────────────────────────────────────
// Helper Hooks
// ──────────────────────────────────────────────────

/**
 * Get config and setter for a specific plugin.
 *
 * @example
 * const [config, setConfig] = usePluginConfig("sonification/oscillator");
 * setConfig({ minFreq: 300 });
 */
export function usePluginConfig<K extends keyof AppPluginConfigRegistry>(
  pluginId: K,
): [AppPluginConfigRegistry[K], (updates: Partial<AppPluginConfigRegistry[K]>) => void] {
  const config = useAppConfigStore((state) => state.pluginConfigs[pluginId]);
  const setConfig = useAppConfigStore((state) => state.setPluginConfig);

  return [config, (updates) => setConfig(pluginId, updates)];
}

/**
 * Get active plugin ID and setter for a specific slot.
 *
 * @example
 * const [activeId, setActiveId] = useActivePlugin("sonification");
 * setActiveId("sonification/oscillator");
 */
export function useActivePlugin<K extends keyof ActivePlugins>(
  slot: K,
): [ActivePlugins[K], (pluginId: ActivePlugins[K]) => void] {
  const activePluginId = useAppConfigStore((state) => state.activePlugins[slot]);
  const setActivePlugin = useAppConfigStore((state) => state.setActivePlugin);

  return [activePluginId, (pluginId) => setActivePlugin(slot, pluginId)];
}

/**
 * Get UI preferences and setter.
 *
 * @example
 * const [prefs, setPrefs] = useUiPreferences();
 * setPrefs({ baseUiOpacity: 0.8 });
 */
export function useUiPreferences(): [UiPreferences, (updates: Partial<UiPreferences>) => void] {
  const prefs = useAppConfigStore((state) => state.uiPreferences);
  const setPrefs = useAppConfigStore((state) => state.setUiPreferences);

  return [prefs, setPrefs];
}
