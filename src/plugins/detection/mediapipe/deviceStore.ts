import { create } from "zustand";
import type { CameraRuntimeError } from "./errors";
import type { DeviceInfo } from "./NativeCamera";

export type CameraStatus = { status: "ok" } | { status: "error"; error: CameraRuntimeError };

interface DeviceStoreState {
  // Runtime camera state (not persisted)
  devices: DeviceInfo[];
  deviceId: string | undefined;
  mirror: boolean;
  setDevices: (devices: DeviceInfo[]) => void;
  setDeviceId: (deviceId: string | undefined) => void;
  setMirror: (mirror: boolean) => void;
  /** Restart the camera (re-triggers getUserMedia). Set by plugin at runtime. */
  restartCamera: (() => Promise<void>) | null;
  setRestartCamera: (fn: (() => Promise<void>) | null) => void;
  /** Camera health state for runtime feedback in UI. */
  cameraStatus: CameraStatus;
  setCameraOk: () => void;
  setCameraError: (error: CameraRuntimeError) => void;
  /** Whether hands are currently detected. null = pipeline not started. */
  hasHands: boolean | null;
  setHasHands: (hasHands: boolean | null) => void;
}

export const useDeviceStore = create<DeviceStoreState>((set) => ({
  devices: [],
  deviceId: undefined,
  mirror: true,
  setDevices: (devices) => set({ devices }),
  setDeviceId: (deviceId) => set({ deviceId }),
  setMirror: (mirror) => set({ mirror }),
  restartCamera: null,
  setRestartCamera: (fn) => set({ restartCamera: fn }),
  cameraStatus: { status: "ok" },
  setCameraOk: () => set({ cameraStatus: { status: "ok" } }),
  setCameraError: (error) => set({ cameraStatus: { status: "error", error } }),
  hasHands: null,
  setHasHands: (hasHands) => set({ hasHands }),
}));
