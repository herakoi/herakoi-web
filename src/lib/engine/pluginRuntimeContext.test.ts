import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppConfigStore } from "#src/state/appConfigStore";
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
});
