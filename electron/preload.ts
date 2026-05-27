/**
 * Sandbox-safe preload bridge.
 *
 * Runs with `sandbox: true` + `contextIsolation: true`, so the only module it
 * may pull in is `electron`, and it must reach the renderer exclusively through
 * `contextBridge.exposeInMainWorld`. The exposed `window.herakoiNative` surface
 * is intentionally tiny: it lets the renderer query and request the macOS camera
 * permission (TCC) and deep-link to the OS privacy settings, all backed by
 * `ipcRenderer.invoke` calls handled in electron/main.ts.
 *
 * The renderer-side contract is mirrored (and typed) in
 * src/shared/platform/native.ts. Keep the two in sync.
 *
 * Source is authored as ESM; vite-plugin-electron emits it as CommonJS
 * (dist-electron/preload.cjs) because a sandboxed preload can only `require`.
 */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("herakoiNative", {
  platform: process.platform,
  getCameraPermissionStatus: () => ipcRenderer.invoke("permissions:getCameraStatus"),
  requestCameraAccess: () => ipcRenderer.invoke("permissions:requestCameraAccess"),
  openCameraSettings: () => ipcRenderer.invoke("permissions:openCameraSettings"),
});
