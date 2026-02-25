/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppConfigStore } from "#src/state/appConfigStore";
import { APP_CONFIG_KEY } from "#src/state/persistenceKeys";
import { createAppConfigPluginRuntimeContext } from "./pluginRuntimeContext";

describe("createAppConfigPluginRuntimeContext", () => {
  let pluginId: string;
  let previousActFlag: unknown;

  beforeEach(() => {
    useAppConfigStore.getState().resetAll();
    pluginId = Object.keys(useAppConfigStore.getState().pluginConfigs)[0] as string;

    previousActFlag = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown })
      .IS_REACT_ACT_ENVIRONMENT;
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  });

  afterEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown }).IS_REACT_ACT_ENVIRONMENT =
      previousActFlag;
  });

  it("reads and writes plugin config via store", () => {
    const runtime = createAppConfigPluginRuntimeContext(pluginId);
    const current = runtime.getConfig() as Record<string, unknown>;
    const [key] = Object.keys(current);

    runtime.setConfig({ [key]: 12345 });

    const updated = runtime.getConfig() as Record<string, unknown>;
    expect(updated[key]).toBe(12345);
  });

  it("subscribes to plugin config updates", () => {
    const runtime = createAppConfigPluginRuntimeContext(pluginId);
    const listener = vi.fn();
    const unsubscribe = runtime.subscribeConfig(listener);

    runtime.setConfig({ __probe__: "ok" });

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it("persists runtime config updates to localStorage", async () => {
    const setItemSpy = vi.spyOn(window.localStorage, "setItem");
    const runtime = createAppConfigPluginRuntimeContext(pluginId);

    runtime.setConfig({ __probe__: "persisted" });
    await Promise.resolve();

    const persistedWrites = setItemSpy.mock.calls.filter(([key]) => key === APP_CONFIG_KEY);
    expect(persistedWrites.length).toBeGreaterThan(0);

    const [, serializedPayload] = persistedWrites[persistedWrites.length - 1] as [string, string];
    const persisted = JSON.parse(serializedPayload) as {
      state: {
        pluginConfigs: Record<string, Record<string, unknown>>;
      };
    };
    expect(persisted.state.pluginConfigs[pluginId].__probe__).toBe("persisted");
  });
});
