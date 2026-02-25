/**
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { pluginConfigDefaults } from "#src/pluginConfigRegistry";
import { useAppConfigStore } from "./appConfigStore";
import { APP_CONFIG_KEY } from "./persistenceKeys";

describe("appConfigStore", () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    useAppConfigStore.getState().resetAll();
  });

  describe("initial state", () => {
    it("should initialize with default active plugins", () => {
      const state = useAppConfigStore.getState();

      expect(state.activePlugins.detection).toBe("detection/mediapipe");
      expect(state.activePlugins.sampling).toBe("sampling/hsv");
      expect(state.activePlugins.sonification).toBe("sonification/oscillator");
      expect(state.activePlugins.visualization).toBeNull();
    });

    it("should initialize with default plugin configs", () => {
      const state = useAppConfigStore.getState();

      expect(state.pluginConfigs).toEqual(pluginConfigDefaults);
    });

    it("should initialize with default UI preferences", () => {
      const state = useAppConfigStore.getState();

      expect(state.uiPreferences.baseUiOpacity).toBe(1);
      expect(state.uiPreferences.dimLogoMark).toBe(false);
    });
  });

  describe("setActivePlugin", () => {
    it("should update active plugin for a slot", () => {
      const { setActivePlugin } = useAppConfigStore.getState();

      setActivePlugin("sonification", "sonification/oscillator");

      expect(useAppConfigStore.getState().activePlugins.sonification).toBe(
        "sonification/oscillator",
      );
    });

    it("should not affect other slots", () => {
      const { setActivePlugin } = useAppConfigStore.getState();
      const initialDetection = useAppConfigStore.getState().activePlugins.detection;

      setActivePlugin("sonification", "sonification/oscillator");

      expect(useAppConfigStore.getState().activePlugins.detection).toBe(initialDetection);
    });
  });

  describe("setPluginConfig", () => {
    it("should update specific plugin config", () => {
      const { setPluginConfig } = useAppConfigStore.getState();

      setPluginConfig("sonification/oscillator", { minFreq: 300 });

      expect(useAppConfigStore.getState().pluginConfigs["sonification/oscillator"].minFreq).toBe(
        300,
      );
    });

    it("should preserve other config properties", () => {
      const { setPluginConfig } = useAppConfigStore.getState();
      const initialMaxFreq =
        useAppConfigStore.getState().pluginConfigs["sonification/oscillator"].maxFreq;

      setPluginConfig("sonification/oscillator", { minFreq: 300 });

      expect(useAppConfigStore.getState().pluginConfigs["sonification/oscillator"].maxFreq).toBe(
        initialMaxFreq,
      );
    });

    it("should not affect other plugin configs", () => {
      const { setPluginConfig } = useAppConfigStore.getState();
      const initialMediaPipe = {
        ...useAppConfigStore.getState().pluginConfigs["detection/mediapipe"],
      };

      setPluginConfig("sonification/oscillator", { minFreq: 300 });

      expect(useAppConfigStore.getState().pluginConfigs["detection/mediapipe"]).toEqual(
        initialMediaPipe,
      );
    });
  });

  describe("setUiPreferences", () => {
    it("should update UI preferences", () => {
      const { setUiPreferences } = useAppConfigStore.getState();

      setUiPreferences({ baseUiOpacity: 0.7 });

      expect(useAppConfigStore.getState().uiPreferences.baseUiOpacity).toBe(0.7);
    });

    it("should preserve other preferences", () => {
      const { setUiPreferences } = useAppConfigStore.getState();
      const initialDimLogoMark = useAppConfigStore.getState().uiPreferences.dimLogoMark;

      setUiPreferences({ baseUiOpacity: 0.7 });

      expect(useAppConfigStore.getState().uiPreferences.dimLogoMark).toBe(initialDimLogoMark);
    });

    it("persists updated preferences to localStorage with expected payload", async () => {
      const setItemSpy = vi.spyOn(window.localStorage, "setItem");
      const { setUiPreferences } = useAppConfigStore.getState();

      setUiPreferences({ baseUiOpacity: 0.7, dimLogoMark: true });
      await Promise.resolve();

      const persistedWrites = setItemSpy.mock.calls.filter(([key]) => key === APP_CONFIG_KEY);
      expect(persistedWrites.length).toBeGreaterThan(0);

      const [, serializedPayload] = persistedWrites[persistedWrites.length - 1] as [string, string];
      const persisted = JSON.parse(serializedPayload) as {
        state: {
          uiPreferences: {
            baseUiOpacity: number;
            dimLogoMark: boolean;
          };
        };
      };

      expect(persisted.state.uiPreferences).toEqual({
        baseUiOpacity: 0.7,
        dimLogoMark: true,
      });
    });
  });

  describe("resetAll", () => {
    it("should reset all configuration to defaults", () => {
      const { setActivePlugin, setPluginConfig, setUiPreferences, resetAll } =
        useAppConfigStore.getState();

      // Change various settings
      setActivePlugin("detection", "detection/mediapipe");
      setActivePlugin("visualization", "visualization/debugHud");
      setPluginConfig("sonification/oscillator", { minFreq: 999 });
      setUiPreferences({ baseUiOpacity: 0.5, dimLogoMark: true });

      // Reset
      resetAll();

      const state = useAppConfigStore.getState();
      expect(state.activePlugins.detection).toBe("detection/mediapipe");
      expect(state.activePlugins.visualization).toBeNull();
      expect(state.pluginConfigs["sonification/oscillator"].minFreq).toBe(200);
      expect(state.uiPreferences.baseUiOpacity).toBe(1);
      expect(state.uiPreferences.dimLogoMark).toBe(false);
    });
  });

  describe("exportConfig", () => {
    it("should return valid JSON with all sections", () => {
      const { exportConfig } = useAppConfigStore.getState();

      const json = exportConfig();
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty("activePlugins");
      expect(parsed).toHaveProperty("pluginConfigs");
      expect(parsed).toHaveProperty("uiPreferences");
    });

    it("should export current configuration state", () => {
      const { setPluginConfig, exportConfig } = useAppConfigStore.getState();

      setPluginConfig("sonification/oscillator", { minFreq: 350 });

      const json = exportConfig();
      const parsed = JSON.parse(json);

      expect(parsed.pluginConfigs["sonification/oscillator"].minFreq).toBe(350);
    });
  });

  describe("importConfig", () => {
    it("should accept valid JSON and update state", () => {
      const { importConfig } = useAppConfigStore.getState();

      const config = JSON.stringify({
        activePlugins: {
          detection: "detection/mediapipe",
          sampling: "sampling/hsv",
          sonification: "sonification/oscillator",
          visualization: null,
        },
        pluginConfigs: {
          "sonification/oscillator": {
            minFreq: 400,
            maxFreq: 800,
            minVol: 0,
            maxVol: 0.3,
            oscillatorType: "square",
          },
        },
        uiPreferences: {
          baseUiOpacity: 0.8,
          dimLogoMark: true,
        },
      });

      importConfig(config);

      const state = useAppConfigStore.getState();
      expect(state.pluginConfigs["sonification/oscillator"].minFreq).toBe(400);
      expect(state.uiPreferences.baseUiOpacity).toBe(0.8);
    });

    it("should merge with defaults for missing config", () => {
      const { importConfig } = useAppConfigStore.getState();

      const partialConfig = JSON.stringify({
        pluginConfigs: {
          "sonification/oscillator": {
            minFreq: 500,
          },
        },
      });

      importConfig(partialConfig);

      const state = useAppConfigStore.getState();
      // Imported value
      expect(state.pluginConfigs["sonification/oscillator"].minFreq).toBe(500);
      // Default value (not overridden)
      expect(state.pluginConfigs["sonification/oscillator"].maxFreq).toBe(700);
      expect(state.uiPreferences.baseUiOpacity).toBe(1);
    });

    it("should throw error for invalid JSON", () => {
      const { importConfig } = useAppConfigStore.getState();
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      expect(() => importConfig("not valid json")).toThrow("Invalid configuration JSON");
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockRestore();
    });
  });
});
