/**
 * Renderer-side bridge to native (Electron) capabilities.
 *
 * In a plain browser (or in tests / `pnpm dev`) `window.herakoiNative` is
 * undefined, so every helper here degrades to a sensible no-op: the app keeps
 * behaving exactly as a web app. Under Electron the bridge (electron/preload.ts)
 * is present and these helpers delegate to the main process over IPC.
 *
 * Lives under `src/shared/` so plugins may import it (Biome plugin-isolation
 * rules forbid plugins importing from app/shell code).
 */

export type CameraPermissionStatus =
  | "not-determined"
  | "granted"
  | "denied"
  | "restricted"
  | "unknown";

interface HerakoiNativeBridge {
  /** Node-style platform string, e.g. "darwin" | "win32" | "linux". */
  platform: string;
  getCameraPermissionStatus(): Promise<CameraPermissionStatus>;
  requestCameraAccess(): Promise<boolean>;
  openCameraSettings(): Promise<boolean>;
}

declare global {
  interface Window {
    /** Exposed by electron/preload.ts via contextBridge. Absent in the browser. */
    herakoiNative?: HerakoiNativeBridge;
  }
}

function bridge(): HerakoiNativeBridge | undefined {
  return typeof window !== "undefined" ? window.herakoiNative : undefined;
}

/** True when running inside the Electron shell (preload bridge present). */
export function isElectron(): boolean {
  return bridge() !== undefined;
}

/** True when running inside Electron on macOS, where TCC pre-flight applies. */
export function isMacElectron(): boolean {
  return bridge()?.platform === "darwin";
}

/** Current OS camera permission. Resolves "granted" outside Electron. */
export function getCameraPermissionStatus(): Promise<CameraPermissionStatus> {
  const native = bridge();
  return native ? native.getCameraPermissionStatus() : Promise.resolve("granted");
}

/**
 * Trigger the OS camera-access prompt (macOS, only when "not-determined").
 * Resolves true outside Electron.
 */
export function requestCameraAccess(): Promise<boolean> {
  const native = bridge();
  return native ? native.requestCameraAccess() : Promise.resolve(true);
}

/**
 * Open the OS privacy settings for the camera. Resolves false outside Electron
 * (and on Linux, which has no universal deep-link).
 */
export function openCameraSettings(): Promise<boolean> {
  const native = bridge();
  return native ? native.openCameraSettings() : Promise.resolve(false);
}
