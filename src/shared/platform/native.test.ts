/**
 * Tests for the renderer-side native bridge.
 *
 * @vitest-environment happy-dom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCameraPermissionStatus,
  isElectron,
  isMacElectron,
  openCameraSettings,
  requestCameraAccess,
} from "./native";

afterEach(() => {
  Reflect.deleteProperty(window, "herakoiNative");
});

describe("native bridge in a plain browser (no preload)", () => {
  it("reports not-electron and resolves safe defaults", async () => {
    expect(isElectron()).toBe(false);
    expect(isMacElectron()).toBe(false);
    await expect(getCameraPermissionStatus()).resolves.toBe("granted");
    await expect(requestCameraAccess()).resolves.toBe(true);
    await expect(openCameraSettings()).resolves.toBe(false);
  });
});

describe("native bridge under Electron (preload present)", () => {
  function installBridge(platform: string) {
    const bridge = {
      platform,
      getCameraPermissionStatus: vi.fn().mockResolvedValue("denied"),
      requestCameraAccess: vi.fn().mockResolvedValue(true),
      openCameraSettings: vi.fn().mockResolvedValue(true),
    };
    Object.defineProperty(window, "herakoiNative", {
      value: bridge,
      writable: true,
      configurable: true,
    });
    return bridge;
  }

  it("detects electron and macOS", () => {
    installBridge("darwin");
    expect(isElectron()).toBe(true);
    expect(isMacElectron()).toBe(true);
  });

  it("detects electron but non-macOS", () => {
    installBridge("win32");
    expect(isElectron()).toBe(true);
    expect(isMacElectron()).toBe(false);
  });

  it("delegates each call to the bridge", async () => {
    const bridge = installBridge("darwin");

    await expect(getCameraPermissionStatus()).resolves.toBe("denied");
    await expect(requestCameraAccess()).resolves.toBe(true);
    await expect(openCameraSettings()).resolves.toBe(true);

    expect(bridge.getCameraPermissionStatus).toHaveBeenCalledTimes(1);
    expect(bridge.requestCameraAccess).toHaveBeenCalledTimes(1);
    expect(bridge.openCameraSettings).toHaveBeenCalledTimes(1);
  });
});
