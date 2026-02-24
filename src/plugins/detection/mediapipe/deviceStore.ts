import { create } from "zustand";
import type { DeviceInfo } from "./NativeCamera";

interface DeviceStoreState {
  devices: DeviceInfo[];
  setDevices: (devices: DeviceInfo[]) => void;
  /** Restart the camera (re-triggers getUserMedia). Set by plugin at runtime. */
  restartCamera: (() => Promise<void>) | null;
  setRestartCamera: (fn: (() => Promise<void>) | null) => void;
}

export const useDeviceStore = create<DeviceStoreState>((set) => ({
  devices: [],
  setDevices: (devices) => set({ devices }),
  restartCamera: null,
  setRestartCamera: (fn) => set({ restartCamera: fn }),
}));
