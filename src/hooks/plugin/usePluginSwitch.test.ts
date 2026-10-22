/**
 * @vitest-environment happy-dom
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppConfigStore } from "#src/state/appConfigStore";
import { usePluginSwitch } from "./usePluginSwitch";

describe("usePluginSwitch", () => {
  beforeEach(() => {
    useAppConfigStore.getState().setActivePlugin("sonification", "sonification/oscillator");
  });

  it("stops the transport before switching and leaves the restart to auto-start", () => {
    const calls: string[] = [];
    const stopTransport = vi.fn(() => {
      calls.push(`stop:${useAppConfigStore.getState().activePlugins.sonification}`);
    });

    const { result } = renderHook(() => usePluginSwitch("sonification", { stopTransport }));
    result.current("sonification/piano-sampler");

    expect(calls).toEqual(["stop:sonification/oscillator"]);
    expect(useAppConfigStore.getState().activePlugins.sonification).toBe(
      "sonification/piano-sampler",
    );
  });
});
